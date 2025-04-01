#![allow(clippy::result_large_err)]

pub mod constants;
pub use constants::*;

use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked}};

declare_id!("HakBGtf9GRgadv2dEGHuVTtT16gVCpfdHn2vQxHdzHJe");

#[program]
pub mod vesting {
    use super::*;

    // Instruction to create a vesting account for an employer.
    // This account will hold the treasury tokens that will be allocated to employees.
    pub fn create_employer_vesting(
        ctx: Context<CreateEmployerVesting>,
        company_name: String,
    ) -> Result<()> {
        *ctx.accounts.employer_vesting = EmployerVesting {
            employer: ctx.accounts.employer.key(), // Owner of the vesting account (employer).
            token_mint: ctx.accounts.token_mint.key(), // SPL token mint being distributed.
            treasury_account: ctx.accounts.treasury_account.key(), // Treasury token account.
            company_name, // Name of the company.
            treasury_bump: ctx.bumps.treasury_account, // Bump for treasury PDA.
            bump: ctx.bumps.employer_vesting, // Bump for vesting account PDA.
        };
        Ok(())
    }

    // Instruction to create an employee account for token vesting.
    // This account tracks the vesting schedule and claimable tokens for an employee.
    pub fn create_employee_vesting(
        ctx: Context<CreateEmployeeVesting>,
        start_time: i64, // Vesting start time (Unix timestamp).
        end_time: i64, // Vesting end time (Unix timestamp).
        cliff_time: i64, // Cliff time before tokens can be claimed (Unix timestamp).
        total_amount: u64, // Total amount of tokens allocated to the employee.
    ) -> Result<()> {
        *ctx.accounts.employee_vesting = EmployeeVesting {
            employee: ctx.accounts.employee.key(), // Employee's public key.
            start_time, // Vesting start time.
            end_time, // Vesting end time.
            cliff_time, // Cliff time.
            total_amount, // Total allocated tokens.
            total_withdrawn: 0, // Initially, no tokens are withdrawn.
            employer_vesting: ctx.accounts.employer_vesting.key(), // Associated vesting account.
            bump: ctx.bumps.employee_vesting, // Bump for employee account PDA.
        };
        Ok(())
    }

    // Instruction for an employee to claim vested tokens.
    // Calculates the claimable amount based on the vesting schedule and transfers tokens.
    pub fn claim_tokens(ctx: Context<ClaimTokens>, _company_name: String) -> Result<()> {
        let employee_vesting = &mut ctx.accounts.employee_vesting;

        // Ensure the current time is past the cliff time.
        let now = Clock::get()?.unix_timestamp; // Current Unix timestamp.
        require!(now >= employee_vesting.cliff_time, ErrorCode::UnavailableClaim);

        let total_vesting_time = employee_vesting.end_time.saturating_sub(employee_vesting.start_time);
        
        // Ensure the vesting period is valid.
        if total_vesting_time == 0 {
          return Err(ErrorCode::InvalidVestingPeriod.into());
        }
        
        // Calculate the total vesting duration and time elapsed since the start.
        let time_since_vesting = now.saturating_sub(employee_vesting.start_time);

        // Calculate the vested amount based on elapsed time.
        let vested_amount = if now >= employee_vesting.end_time {
            // All tokens are claimable after the vesting period ends.
            employee_vesting.total_amount
        } else {
            match employee_vesting.total_amount.checked_mul(time_since_vesting as u64) {
                Some(result) => result / total_vesting_time as u64,
                None => return Err(ErrorCode::CalculationOverflow.into()),
            }
        };

        // Calculate the claimable amount by subtracting already withdrawn tokens.
        let claimable_amount = vested_amount.saturating_sub(employee_vesting.total_withdrawn);
        require!(claimable_amount > 0, ErrorCode::ZeroClaim);

        // Prepare CPI (Cross-Program Invocation) for transferring tokens.
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.treasury_account.to_account_info(),
            mint: ctx.accounts.token_mint.to_account_info(),
            to: ctx.accounts.employee_token_account.to_account_info(),
            authority: ctx.accounts.treasury_account.to_account_info(),
        };

        // Define signer seeds for the treasury PDA.
        let seeds: &[&[&[u8]]] = &[&[
          b"vesting_treasury",
          ctx.accounts.employer_vesting.company_name.as_ref(),
          &[ctx.accounts.employer_vesting.treasury_bump]
        ]];

        token_interface::transfer_checked(
          CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
          claimable_amount,
          ctx.accounts.token_mint.decimals
        )?;

        // Update the total withdrawn amount in the employee account.
        employee_vesting.total_withdrawn = employee_vesting.total_withdrawn.checked_add(claimable_amount).ok_or(ErrorCode::CalculationOverflow)?;

        Ok(())
    }
}

// Account struct for creating a vesting account.
#[derive(Accounts)]
#[instruction(company_name: String)]
pub struct CreateEmployerVesting<'info> {
    #[account(mut)]
    pub employer: Signer<'info>, // Employer creating the vesting account.

    #[account(
        init,
        payer = employer,
        space = ANCHOR_DISCRIMINATOR_SIZE + EmployerVesting::INIT_SPACE,
        seeds = [b"employer_vesting", company_name.as_bytes()],
        bump
    )]
    pub employer_vesting: Account<'info, EmployerVesting>, // PDA for the vesting account, tied to the company name.

    pub token_mint: InterfaceAccount<'info, Mint>, // SPL token mint to be distributed.

    #[account(
        init, 
        token::mint = token_mint, 
        // token::authority = treasury_account, 
        token::authority = employer_vesting, 
        payer = employer, 
        seeds = [b"vesting_treasury", company_name.as_bytes()], 
        bump
    )]
    pub treasury_account: InterfaceAccount<'info, TokenAccount>, // PDA for the treasury token account, holding tokens for distribution.

    pub token_program: Interface<'info, TokenInterface>, // Token interface for managing SPL tokens.
    pub system_program: Program<'info, System>, // System program for account initialization.
}

#[derive(Accounts)]
pub struct CreateEmployeeVesting<'info> {
    #[account(mut)]
    pub employer: Signer<'info>, // Employer allocating tokens to the employee.

    pub employee: SystemAccount<'info>, // Employee receiving the tokens.

    #[account(
        has_one = employer,
    )]
    pub employer_vesting: Account<'info, EmployerVesting>, // Vesting account associated with the employer.

    #[account(
        init,
        payer = employer, 
        space = ANCHOR_DISCRIMINATOR_SIZE + EmployeeVesting::INIT_SPACE,
        seeds = [b"employee_vesting", employee.key().as_ref(), employer_vesting.key().as_ref()], 
        bump
    )]
    pub employee_vesting: Account<'info, EmployeeVesting>, // PDA for the employee's vesting account.

    pub system_program: Program<'info, System>, // System program for account initialization.
}

#[derive(Accounts)]
#[instruction(company_name: String)]
pub struct ClaimTokens<'info> {
    #[account(mut)]
    pub employee: Signer<'info>, // Employee claiming the vested tokens.

    #[account(
        mut,
        seeds = [b"employee_vesting", employee.key().as_ref(), employer_vesting.key().as_ref()], 
        has_one = employee,
        has_one = employer_vesting,
        bump = employee_vesting.bump,
    )]
    pub employee_vesting: Account<'info, EmployeeVesting>, // Employee's vesting account, ensuring correct employee and vesting account.

    pub token_mint: InterfaceAccount<'info, Mint>, // SPL token mint being claimed.

    #[account(
        mut,
        seeds = [b"employer_vesting", company_name.as_bytes()],
        has_one = treasury_account,
        has_one = token_mint,
        bump = employer_vesting.bump,
    )]
    pub employer_vesting: Account<'info, EmployerVesting>, // Employer's vesting account, ensuring correct treasury and mint.

    #[account(mut)]
    pub treasury_account: InterfaceAccount<'info, TokenAccount>, // Treasury token account holding tokens for distribution.

    #[account(
        init_if_needed,
        payer = employee,
        associated_token::mint = token_mint,
        associated_token::authority = employee, 
        associated_token::token_program = token_program, 
    )]
    pub employee_token_account: InterfaceAccount<'info, TokenAccount>, // Employee's token account to receive the claimed tokens.

    pub token_program: Interface<'info, TokenInterface>, // Token program for managing SPL tokens.
    pub associated_token_program: Program<'info, AssociatedToken>, // Associated token program for creating token accounts.
    pub system_program: Program<'info, System>, // System program for account initialization.
}

#[account]
#[derive(InitSpace, Debug)]
pub struct EmployerVesting {
    pub employer: Pubkey, // Employer who owns this vesting account.
    #[max_len(30)]
    pub company_name: String, // Name of the company associated with this vesting account.
    pub token_mint: Pubkey, // SPL token mint being distributed.
    pub treasury_account: Pubkey, // Treasury token account holding tokens for distribution.
    pub treasury_bump: u8, // Bump seed for the treasury PDA.
    pub bump: u8, // Bump seed for the vesting account PDA.
}

#[account]
#[derive(InitSpace, Debug)]
pub struct EmployeeVesting {
    pub employee: Pubkey, // Employee receiving the vested tokens.
    pub employer_vesting: Pubkey, // Associated vesting account.
    pub total_amount: u64, // Total tokens allocated to the employee.
    pub total_withdrawn: u64, // Total tokens already claimed by the employee.
    pub start_time: i64, // Vesting start time (Unix timestamp).
    pub end_time: i64, // Vesting end time (Unix timestamp).
    pub cliff_time: i64, // Cliff time before tokens can be claimed (Unix timestamp).
    pub bump: u8, // Bump seed for the employee account PDA.
}

#[error_code]
pub enum ErrorCode {
    #[msg("Claim not available yet")]
    UnavailableClaim, // Error when tokens are claimed before the cliff time.

    #[msg("Invalid vesting period")]
    InvalidVestingPeriod, // Error when the vesting period is invalid (e.g., start time equals end time).

    #[msg("Calculation overflow")]
    CalculationOverflow, // Error when a calculation overflows.

    #[msg("No tokens to claim")]
    ZeroClaim, // Error when there are no tokens available to claim.
}