# Solana Token Vesting dApp

A decentralized token vesting application built on Solana using the Anchor framework. This dApp allows authorities to create vesting schedules for beneficiaries, where tokens are gradually unlocked over time according to predefined parameters.

## Features

- Create vesting authorities to manage token allocations
- Set up custom vesting schedules with configurable parameters:
  - Linear vesting over defined periods
  - Customizable cliff periods before tokens unlock
  - Full vesting at schedule completion
- Self-custodial treasury accounts controlled by the program
- Schedule revocation by authorities
- Secure token claiming for beneficiaries
- Visual progress tracking of vesting schedules
- Comprehensive event tracking with detailed logs
- Intuitive UI with real-time updates

## Getting Started

### Prerequisites

Ensure you have the following installed:

- **Node.js**: v18 or higher
- **Rust**: v1.68.0 or higher
- **Anchor CLI**: v0.29.0 or higher
- **Solana CLI**: v1.16.0 or higher

### Installation

1. Clone the repository:

   ```shell
   git clone git@github.com:iamramtin/token-vesting-dapp.git
   cd token-vesting-dapp
   ```

2. Install dependencies:

   ```shell
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. Start the web app:
   ```shell
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

## Program Setup

### Deploy the Program

1. Build the program:

   ```shell
   anchor build
   ```

2. Deploy to your chosen network:

   ```shell
   # For local development
   anchor deploy --provider.cluster localhost

   # For devnet
   anchor deploy --provider.cluster devnet
   ```

## Testing the dApp

### Run the Test Suite

```shell
anchor test
```

### Setup a Local Validator

```shell
solana-test-validator
```

### Create Test SPL Tokens

1. Generate a new token mint:

   ```shell
   spl-token create-token --url localhost
   ```

   This will output a token mint address like: `CkoDpiy2MSCS8fUiZ3BzBGmw3Q8Q1KRrUoRA6wAJTy25`

2. Create a token account for your wallet:

   ```shell
   spl-token create-account <TOKEN_MINT_ADDRESS> --url localhost
   ```

3. Mint tokens to your account:
   ```shell
   spl-token mint <TOKEN_MINT_ADDRESS> 1000000 --url localhost
   ```

### Create Test Accounts

1. Generate new Solana addresses for testing:

   ```shell
   # Generate beneficiary keypair
   solana-keygen new --no-bip39-passphrase -o beneficiary-keypair.json

   # Get the public key to use as beneficiary address
   solana address -k beneficiary-keypair.json
   ```

2. Fund the test accounts:
   ```shell
   solana airdrop 2 $(solana address -k beneficiary-keypair.json) --url localhost
   ```

## Using the dApp

### Creating a Vesting Authority

1. Connect your wallet
2. Click "Create Vesting Authority"
3. Enter your organization/project identifier (vesting ID)
4. Enter the SPL token mint address you created earlier
5. Click "Create"

### Funding the Treasury

After creating a vesting authority:

1. Copy the treasury account address from your vesting authority card
2. Send tokens to this address:
   ```shell
   spl-token transfer <TOKEN_MINT_ADDRESS> <AMOUNT> <TREASURY_ADDRESS> --fund-recipient --url localhost
   ```

### Creating Vesting Schedules for Beneficiaries

1. Click "Add Beneficiary" on your vesting authority card
2. Enter the beneficiary's wallet address (use the test address you generated)
3. Enter the vesting parameters:
   - **Token Amount**: Total tokens to vest (e.g., 10000)
   - **Start Date**: When vesting begins
   - **Cliff Date**: When tokens first become available
   - **End Date**: When 100% of tokens are vested
4. Click "Create Schedule"

### Claiming Tokens (Beneficiary)

1. Connect with the beneficiary's wallet
2. Navigate to "Your Vesting Schedules"
3. View vesting progress and available tokens
4. Click "Claim Tokens" when tokens are available (after cliff period)

### Revoking Schedules (Authority)

1. Connect with the authority wallet
2. Navigate to "Your Vesting Authorities"
3. Select the specific beneficiary schedule
4. Click "Revoke Schedule"
5. Confirm the revocation

## Troubleshooting

### Common Issues

1. **Program ID Mismatch**:

   - Run `node scripts/checkProgramId.ts --update` to fix mismatches
   - Ensure the dApp and frontend code are updated with the correct program ID.

2. **Transaction Simulation Failed**:

   - Check that your treasury has sufficient tokens
   - Ensure your dates for vesting make sense (start < cliff < end)
   - Verify token amounts are greater than zero

3. **Account Not Found**:

   - Verify the program is deployed to the correct network
   - Check you're connected to the right cluster in the UI

4. **Insufficient Funds**:

   - Run `solana airdrop 2 <YOUR_ADDRESS> --url localhost` for SOL
   - For test tokens, mint more using `spl-token mint <TOKEN_MINT_ADDRESS> <AMOUNT>`

5. **Revocation Issues**:
   - Ensure only the authority is attempting to revoke schedules
   - Verify the schedule hasn't already been revoked
   - Check that all required accounts are passed to the revoke instruction

## Architecture

### On-Chain Program (Anchor/Rust)

- **VestingAuthority**: Account to manage token allocations and track the treasury
- **VestingSchedule**: Account for individual beneficiary vesting schedules
- **Instructions**:
  - `createVestingAuthority`: Create a vesting authority with a treasury
  - `createVestingSchedule`: Create a vesting schedule for a beneficiary
  - `claim`: Allow beneficiaries to claim vested tokens
  - `revokeSchedule`: Allow authorities to revoke vesting schedules

### Account Structure

- **VestingAuthority**:

  - `authority`: The wallet that controls this vesting authority
  - `vesting_id`: Unique identifier for this authority
  - `token_mint`: The SPL token being distributed
  - `treasury_account`: Self-custodial account holding the tokens

- **VestingSchedule**:
  - `beneficiary`: Recipient of the vested tokens
  - `vesting_authority`: Associated vesting authority
  - `total_amount`: Total tokens allocated
  - `total_withdrawn`: Tokens already claimed
  - `start_time`, `end_time`, `cliff_time`: Vesting parameters
  - `revoked_at`: Optional timestamp when schedule was revoked

### Frontend (Next.js/React)

- **vesting-data-access.tsx**: Custom hooks for interacting with the Solana program
- **vesting-ui.tsx**: UI components for the vesting interface
- **vesting-feature.tsx**: Main component combining data and UI layers
- **page.tsx**: Next.js page component

## Future Enhancements

Planned improvements to the dApp include:

1. **Treasury Funding Instruction**: Direct on-chain method to fund the treasury
2. **Schedule Modification**: Ability to modify existing schedules
3. **Batch Processing**: Create multiple schedules or claim from multiple schedules at once

## License

This project is licensed under the MIT License - see the LICENSE file for details.
