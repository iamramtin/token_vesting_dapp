#![allow(clippy::result_large_err)]

pub mod constants;
pub use constants::*;

use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked}};

declare_id!("Akr4zGgrNpMh6wgASsH24epvwmRXD7biTYhcC2z65GwV");

/// A token vesting program that allows gradual release of tokens to beneficiaries
/// over a predefined schedule. Features include:
/// - Creating vesting authorities that can manage multiple beneficiaries
/// - Setting up custom vesting schedules with start time, end time, and cliff
/// - Claiming vested tokens based on elapsed time (linear vesting)
/// - Revoking vesting schedules by the authority
#[program]
pub mod vesting {
    use super::*;

    // Sets up a vesting authority that manages token allocations
    pub fn create_vesting_authority(
        ctx: Context<CreateVestingAuthority>,
        vesting_id: String,
    ) -> Result<()> {
        *ctx.accounts.vesting_authority = VestingAuthority {
            authority: ctx.accounts.authority.key(),
            token_mint: ctx.accounts.token_mint.key(),
            treasury_account: ctx.accounts.treasury_account.key(),
            vesting_id,
            treasury_bump: ctx.bumps.treasury_account,
            bump: ctx.bumps.vesting_authority,
        };

        emit!(VestingAuthorityCreated {
            authority: ctx.accounts.authority.key(),
            vesting_id: ctx.accounts.vesting_authority.vesting_id.clone(),
            token_mint: ctx.accounts.token_mint.key(),
            created_at: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // Creates a vesting schedule for a beneficiary
    pub fn create_vesting_schedule(
        ctx: Context<CreateVestingSchedule>,
        start_time: i64,
        end_time: i64,
        cliff_time: i64,
        total_amount: u64,
    ) -> Result<()> {
        require!(end_time > start_time, ErrorCode::InvalidVestingPeriod);
        require!(cliff_time >= start_time, ErrorCode::InvalidCliffTime);
        require!(total_amount > 0, ErrorCode::ZeroAmount);
        
        *ctx.accounts.vesting_schedule = VestingSchedule {
            beneficiary: ctx.accounts.beneficiary.key(),
            vesting_authority: ctx.accounts.vesting_authority.key(),
            total_amount,
            total_withdrawn: 0,
            start_time,
            end_time,
            cliff_time,
            revoked_at: None,
            bump: ctx.bumps.vesting_schedule,
        };

        emit!(ScheduleCreated {
            vesting_id: ctx.accounts.vesting_authority.vesting_id.clone(),
            beneficiary: ctx.accounts.beneficiary.key(),
            total_amount,
            start_time,
        });

        Ok(())
    }

    //  Intended to revoke a schedule
    pub fn revoke_schedule(ctx: Context<RevokeSchedule>) -> Result<()> {
        let vesting_schedule= &mut ctx.accounts.vesting_schedule;
        
        require!(vesting_schedule.revoked_at.is_none(), ErrorCode::AlreadyRevoked);
        
        vesting_schedule.revoked_at = Some(Clock::get()?.unix_timestamp);

        emit!(ScheduleRevoked {
            vesting_id: ctx.accounts.vesting_authority.vesting_id.clone(),
            beneficiary: vesting_schedule.beneficiary,
            revoked_at: vesting_schedule.revoked_at.unwrap(),
            unclaimed_amount: vesting_schedule
                .total_amount
                .checked_sub(vesting_schedule.total_withdrawn)
                .ok_or(ErrorCode::CalculationOverflow)?,
        });

        Ok(())
    }

    // Lets beneficiaries claim vested tokens
    pub fn claim(ctx: Context<Claim>, _vesting_id: String) -> Result<()> {
        let vesting_schedule = &mut ctx.accounts.vesting_schedule;
        
        require!(vesting_schedule.revoked_at.is_none(), ErrorCode::RevokedSchedule);

        // Ensure the current time is past the cliff time and not revoked.
        let now = Clock::get()?.unix_timestamp;
        require!(now >= vesting_schedule.cliff_time, ErrorCode::UnavailableClaim);

        let claimable_amount = vesting_schedule.claimable_amount(now)?;

        // Prepare CPI (Cross-Program Invocation) for transferring tokens.
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.treasury_account.to_account_info(),
            mint: ctx.accounts.token_mint.to_account_info(),
            to: ctx.accounts.beneficiary_token_account.to_account_info(),
            authority: ctx.accounts.treasury_account.to_account_info(),
        };

        // Define signer seeds for the treasury PDA.
        let seeds: &[&[&[u8]]] = &[&[
          b"vesting_treasury",
          ctx.accounts.vesting_authority.vesting_id.as_ref(),
          &[ctx.accounts.vesting_authority.treasury_bump]
        ]];

        token_interface::transfer_checked(
          CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds),
          claimable_amount,
          ctx.accounts.token_mint.decimals
        )?;

        // Update the total withdrawn amount in the beneficiary account.
        vesting_schedule.total_withdrawn = vesting_schedule.total_withdrawn.checked_add(claimable_amount).ok_or(ErrorCode::CalculationOverflow)?;

        emit!(TokensClaimed {
            beneficiary: *ctx.accounts.beneficiary.key,
            amount: claimable_amount,
            claimed_at: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(vesting_id: String)]
pub struct CreateVestingAuthority<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = ANCHOR_DISCRIMINATOR_SIZE + VestingAuthority::INIT_SPACE,
        seeds = [b"vesting_authority", vesting_id.as_bytes()],
        bump
    )]
    pub vesting_authority: Account<'info, VestingAuthority>, // PDA for the vesting account.

    pub token_mint: InterfaceAccount<'info, Mint>, // SPL token mint to be distributed.

    // The treasury account is a PDA controlled by the program, not by any external authority.
    // Ensures tokens can only be distributed according to the program's logic.
    #[account(
        init, 
        token::mint = token_mint, 
        token::authority = treasury_account, 
        payer = authority, 
        seeds = [b"vesting_treasury", vesting_id.as_bytes()], 
        bump
    )]
    pub treasury_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateVestingSchedule<'info> {
    #[account(mut)]
    pub authority: Signer<'info>, // Authority allocating tokens to the beneficiary.

    pub beneficiary: SystemAccount<'info>, // Beneficiary receiving the tokens.

    #[account(
        has_one = authority,
    )]
    pub vesting_authority: Account<'info, VestingAuthority>, // Vesting account associated with the authority.

    #[account(
        init,
        payer = authority, 
        space = ANCHOR_DISCRIMINATOR_SIZE + VestingSchedule::INIT_SPACE,
        seeds = [b"vesting_schedule", beneficiary.key().as_ref(), vesting_authority.key().as_ref()], 
        bump
    )]
    pub vesting_schedule: Account<'info, VestingSchedule>, // PDA for the beneficiary's vesting account.

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeSchedule<'info> {
    #[account(mut)]
    pub authority: Signer<'info>, // Authority revoking the schedule.

    #[account(
        mut,
        has_one = authority,
        seeds = [b"vesting_authority", vesting_authority.vesting_id.as_bytes()],
        bump = vesting_authority.bump
    )]
    pub vesting_authority: Account<'info, VestingAuthority>,

    #[account(
        mut,
        has_one = vesting_authority,
        seeds = [b"vesting_schedule", vesting_schedule.beneficiary.as_ref(), vesting_authority.key().as_ref()],
        bump = vesting_schedule.bump
    )]
    pub vesting_schedule: Account<'info, VestingSchedule>,
}

#[derive(Accounts)]
#[instruction(vesting_id: String)]
pub struct Claim<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,

    #[account(
        mut,
        // Ensure the signer is the beneficiary
        has_one = beneficiary,
        // Link to vesting authority
        has_one = vesting_authority,
        // PDA verification 
        seeds = [b"vesting_schedule", beneficiary.key().as_ref(), vesting_authority.key().as_ref()], 
        bump = vesting_schedule.bump,
    )]
    pub vesting_schedule: Account<'info, VestingSchedule>, // Beneficiary's vesting account, ensuring correct beneficiary and vesting authority.

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        has_one = treasury_account,
        has_one = token_mint,
        seeds = [b"vesting_authority", vesting_id.as_bytes()],
        bump = vesting_authority.bump,
    )]
    pub vesting_authority: Account<'info, VestingAuthority>, // Authority's vesting account, ensuring correct treasury and mint.

    #[account(mut)]
    pub treasury_account: InterfaceAccount<'info, TokenAccount>, // Treasury token account holding tokens for distribution.

    #[account(
        init_if_needed,
        payer = beneficiary,
        associated_token::mint = token_mint,
        associated_token::authority = beneficiary, 
        associated_token::token_program = token_program, 
    )]
    pub beneficiary_token_account: InterfaceAccount<'info, TokenAccount>, // Beneficiary's token account to receive the claimed tokens.

    pub token_program: Interface<'info, TokenInterface>, // Token program for managing SPL tokens.
    pub associated_token_program: Program<'info, AssociatedToken>, // Associated token program for creating token accounts.
    pub system_program: Program<'info, System>,
}

// Tracks the authority who manages the vesting, the token mint, and the treasury account.
#[account]
#[derive(InitSpace, Debug)]
pub struct VestingAuthority {
    pub authority: Pubkey, // Authority who owns this vesting account.
    #[max_len(30)]
    pub vesting_id: String,
    pub token_mint: Pubkey, // SPL token mint being distributed.
    pub treasury_account: Pubkey, // Treasury token account holding tokens for distribution.
    pub treasury_bump: u8,
    pub bump: u8,
}

// Tracks the beneficiary's vesting schedule details.
#[account]
#[derive(InitSpace, Debug)]
pub struct VestingSchedule {
    pub beneficiary: Pubkey, // Beneficiary receiving the vested tokens.
    pub vesting_authority: Pubkey, // Associated vesting authority account.
    pub total_amount: u64, // Total tokens allocated to the beneficiary.
    pub total_withdrawn: u64, // Total tokens already claimed by the beneficiary.
    pub start_time: i64, // Vesting start time (Unix timestamp).
    pub end_time: i64, // Vesting end time (Unix timestamp).
    pub cliff_time: i64, // Cliff time before tokens can be claimed (Unix timestamp).
    pub revoked_at: Option<i64>, // Revoked time (if revoked - Unix timestamp)
    pub bump: u8,
}

impl VestingSchedule {
    // Calculates how many tokens a beneficiary can claim at the current time based on linear vesting.
    pub fn claimable_amount(&self, now: i64) -> Result<u64> {
        let vesting_duration = self.end_time.saturating_sub(self.start_time);
        if vesting_duration == 0 {
            return Err(ErrorCode::InvalidVestingPeriod.into());
        }

        let time_elapsed = now.saturating_sub(self.start_time);
        let vested_amount = if now >= self.end_time {
            // All tokens are claimable after the vesting period ends.
            self.total_amount
        } else {
            self.total_amount
                .checked_mul(time_elapsed as u64)
                .ok_or(ErrorCode::CalculationOverflow)?
                / (vesting_duration as u64)
        };

        let claimable_amount = vested_amount.saturating_sub(self.total_withdrawn);
        require!(claimable_amount > 0, ErrorCode::ZeroClaim);

        Ok(claimable_amount)
    }
}

#[event]
pub struct VestingAuthorityCreated {
    pub authority: Pubkey,
    pub vesting_id: String,
    pub token_mint: Pubkey,
    pub created_at: i64,
}

#[event]
pub struct ScheduleCreated {
    pub vesting_id: String,
    pub beneficiary: Pubkey,
    pub total_amount: u64,
    pub start_time: i64,
}

#[event]
pub struct ScheduleRevoked {
    pub vesting_id: String,
    pub beneficiary: Pubkey,
    pub revoked_at: i64,
    pub unclaimed_amount: u64,
}

#[event]
pub struct TokensClaimed {
    pub beneficiary: Pubkey,
    pub amount: u64,
    pub claimed_at: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Calculation overflow")]
    CalculationOverflow,

    #[msg("Zero amount")]
    ZeroAmount,

    #[msg("No tokens to claim")]
    ZeroClaim,

    #[msg("Claim not available yet")]
    UnavailableClaim,

    #[msg("Invalid vesting period")]
    InvalidVestingPeriod,

    #[msg("Invalid cliff time")]
    InvalidCliffTime,

    #[msg("Schedule has been revoked")]
    RevokedSchedule,
    
    #[msg("Schedule has already been revoked")]
    AlreadyRevoked,
}