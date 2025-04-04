# Solana Token Vesting dApp

A decentralized token vesting application built on Solana using the Anchor framework. This dApp allows organizations to create vesting schedules for employees or stakeholders, where tokens are gradually unlocked over time according to predefined parameters.

## Features

- Create vesting accounts for organizations/projects
- Add employees with custom vesting schedules
- Linear vesting with configurable cliff periods
- Visual progress tracking of vesting schedules
- Secure token claiming for employees
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
   # Generate employee keypair
   solana-keygen new --no-bip39-passphrase -o employee-keypair.json

   # Get the public key to use as employee address
   solana address -k employee-keypair.json
   ```

2. Fund the test accounts:
   ```shell
   solana airdrop 2 $(solana address -k employee-keypair.json) --url localhost
   ```

## Using the dApp

### Creating a Vesting Account (Employer)

1. Connect your wallet
2. Click "Create Vesting Account"
3. Enter your company/project name
4. Enter the SPL token mint address you created earlier
5. Click "Create Vesting Account"

### Funding the Treasury

After creating a vesting account:

1. Copy the treasury account address from your vesting account card
2. Send tokens to this address:
   ```shell
   spl-token transfer <TOKEN_MINT_ADDRESS> <AMOUNT> <TREASURY_ADDRESS> --fund-recipient --url localhost
   ```

### Adding Employees to a Vesting Schedule

1. Click "Add Employee" on your vesting account card
2. Enter the employee's wallet address (use the test address you generated)
3. Enter the vesting parameters:
   - **Token Amount**: Total tokens to vest (e.g., 10000)
   - **Start Date**: When vesting begins
   - **Cliff Date**: When tokens first become available
   - **End Date**: When 100% of tokens are vested
4. Click "Add Employee"

### Claiming Tokens (Employee)

1. Connect with the employee's wallet
2. Navigate to "Your Vesting Grants"
3. View vesting progress and available tokens
4. Click "Claim Tokens" when tokens are available (after cliff period)

## Troubleshooting

### Common Issues

1. **Program ID Mismatch**:

   - Run `node scripts/checkProgramId.ts --update` to fix mismatches
   - Ensure the dApp and frontend code are updated with the correct program ID.

2. **Transaction Simulation Failed**:

   - Check that your treasury has sufficient tokens
   - Ensure your dates for vesting make sense (start < cliff < end)

3. **Account Not Found**:

   - Verify the program is deployed to the correct network
   - Check you're connected to the right cluster in the UI

4. **Insufficient Funds**:
   - Run `solana airdrop 2 <YOUR_ADDRESS> --url localhost` for SOL
   - For test tokens, mint more using `spl-token mint <TOKEN_MINT_ADDRESS> <AMOUNT>`

## Architecture

### On-Chain Program (Anchor/Rust)

- **EmployerVesting**: Account for organizations to manage vesting schedules
- **EmployeeVesting**: Account for individual employee vesting schedules
- **Instructions**:
  - `createEmployerVesting`: Create a vesting account for an organization
  - `createEmployeeVesting`: Add an employee to a vesting schedule
  - `claimTokens`: Allow employees to claim vested tokens

### Frontend (Next.js/React)

- **vesting-data-access.tsx**: Custom hooks for interacting with the Solana program
- **vesting-ui.tsx**: UI components for the vesting interface
- **vesting-feature.tsx**: Main component combining data and UI layers
- **page.tsx**: Next.js page component

## License

This project is licensed under the MIT License - see the LICENSE file for details.
