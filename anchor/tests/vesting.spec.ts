import * as anchor from "@coral-xyz/anchor";
import { BankrunProvider } from "anchor-bankrun";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN, Program } from "@coral-xyz/anchor";

import { startAnchor, ProgramTestContext, Clock } from "solana-bankrun";

import { createMint, mintTo } from "spl-token-bankrun";
import { PublicKey, Keypair } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

import IDL from "../target/idl/vesting.json";
import { Vesting } from "../target/types/vesting";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

describe("Vesting Smart Contract Tests", () => {
  // Constants for testing
  const companyName = "Mesgari Inc";
  const startTime = Math.floor(Date.now() / 1000);
  const endTime = startTime + 60 * 60 * 24 * 365; // 1 year later
  const cliffTime = startTime + 60 * 60 * 24 * 30; // 1 month later
  const claimTime = startTime + 60 * 60 * 24 * 60; // 2 months later
  const mintDecimals = 2;
  const treasuryAmount = 10_000 * 10 ** mintDecimals;
  const employeeAllocation = 1_000 * 10 ** mintDecimals;

  // Keypairs
  const employee = Keypair.generate();
  let employer: Keypair;

  // Derived addresses
  let mint: PublicKey;
  let employerVestingPDA: PublicKey;
  let treasuryPDA: PublicKey;
  let employeeVestingPDA: PublicKey;

  // Contexts
  let context: ProgramTestContext;
  let employerProgram: Program<Vesting>;
  let employeeProgram: Program<Vesting>;

  beforeAll(async () => {
    const programId = new PublicKey(IDL.address);

    context = await startAnchor(
      "",
      [{ name: "vesting", programId }],
      [
        {
          address: employee.publicKey,
          info: {
            lamports: 1_000_000_000,
            data: Buffer.alloc(0),
            owner: SYSTEM_PROGRAM_ID,
            executable: false,
          },
        },
      ]
    );

    // Setup employer
    const employerProvider = new BankrunProvider(context);
    anchor.setProvider(employerProvider);
    employerProgram = new Program(IDL as Vesting, employerProvider);
    employer = employerProvider.wallet.payer;

    // Create SPL token mint controlled by employer
    mint = await createMint(
      context.banksClient,
      employer,
      employer.publicKey,
      null,
      mintDecimals
    );

    // Setup employee program
    const employeeProvider = new BankrunProvider(context);
    employeeProvider.wallet = new NodeWallet(employee);
    employeeProgram = new Program(IDL as Vesting, employeeProvider);

    // Derive PDAs
    [employerVestingPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("employer_vesting"), Buffer.from(companyName)],
      employerProgram.programId
    );

    [treasuryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("vesting_treasury"), Buffer.from(companyName)],
      employerProgram.programId
    );

    [employeeVestingPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("employee_vesting"),
        employee.publicKey.toBuffer(),
        employerVestingPDA.toBuffer(),
      ],
      employerProgram.programId
    );
  });

  it("creates employer vesting account", async () => {
    try {
      const tx = await employerProgram.methods
        .createEmployerVesting(companyName)
        .accounts({
          employer: employer.publicKey,
          tokenMint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: "confirmed" });

      console.log("Create employer vesting account transaction signature:", tx);

      const vestingAccount =
        await employerProgram.account.employerVesting.fetch(employerVestingPDA);

      expect(vestingAccount.employer.toBase58()).toBe(
        employer.publicKey.toBase58()
      );

      console.log(
        "Employer vesting account:",
        JSON.stringify(vestingAccount, null, 2)
      );
    } catch (error: any) {
      console.error("Create employer vesting account failed:", error);
      throw new Error("Create employee vesting account failed");
    }
  });

  it("funds treasury token account", async () => {
    try {
      const tx = await mintTo(
        context.banksClient,
        employer,
        mint,
        treasuryPDA,
        employer,
        treasuryAmount
      );

      console.log("Mint treasury token account transaction signature:", tx);
    } catch (error: any) {
      console.error("Funding treasury token account failed:", error);
      throw new Error("Funding treasury token account failed");
    }
  });

  it("creates employee vesting account", async () => {
    try {
      const tx = await employerProgram.methods
        .createEmployeeVesting(
          new BN(startTime),
          new BN(endTime),
          new BN(cliffTime),
          new BN(employeeAllocation)
        )
        .accounts({
          employee: employee.publicKey,
          employerVesting: employerVestingPDA,
        })
        .rpc({ commitment: "confirmed", skipPreflight: true });

      console.log("Create employee account transaction signature:", tx);

      const employeeVesting =
        await employerProgram.account.employeeVesting.fetch(employeeVestingPDA);
      expect(employeeVesting.totalAmount.toNumber()).toBe(employeeAllocation);

      console.log(
        "Employee vesting account:",
        JSON.stringify(employeeVesting, null, 2)
      );
    } catch (error: any) {
      console.error("Create employee vesting account failed:", error);
      throw new Error("Create employee vesting account failed");
    }
  });

  it("fails to claim tokens before cliff time", async () => {
    try {
      const tx = await employeeProgram.methods
        .claimTokens(companyName)
        .accounts({
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: "confirmed" });

      console.error("Claim succeeded unexpectedly:", tx);
      fail("Claim should have failed before cliff time");
    } catch (error: any) {
      expect(error.message).toContain("Claim not available yet");
      console.log("Claim before cliff time failed as expected:", error.message);
    }
  });

  it("allows employee to claim vested tokens after cliff time", async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Simulate time passing by advancing the clock
    const currentClock = await context.banksClient.getClock();

    context.setClock(
      new Clock(
        currentClock.slot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        BigInt(claimTime)
      )
    );

    try {
      const tx = await employeeProgram.methods
        .claimTokens(companyName)
        .accounts({
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: "confirmed" });

      expect(typeof tx).toBe("string");
      console.log("Claim tokens transaction signature", tx);
    } catch (error: any) {
      console.error("Claim tokens failed unexpectedly:", error);
      throw new Error("Claim should have succeeded after cliff time");
    }
  });
});
