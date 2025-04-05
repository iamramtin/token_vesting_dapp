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
  const treasuryTokenAllocation = 10_000 * 10 ** mintDecimals;
  const beneficiaryTokenAllocation = 1_000 * 10 ** mintDecimals;

  // Keypairs
  const beneficiary = Keypair.generate();
  let authority: Keypair;

  // Derived addresses
  let mint: PublicKey;
  let vestingAuthorityPda: PublicKey;
  let treasuryPda: PublicKey;
  let vestingSchedulePda: PublicKey;

  // Contexts
  let context: ProgramTestContext;
  let authorityProgram: Program<Vesting>;
  let scheduleProgram: Program<Vesting>;

  beforeAll(async () => {
    const programId = new PublicKey(IDL.address);

    context = await startAnchor(
      "",
      [{ name: "vesting", programId }],
      [
        {
          address: beneficiary.publicKey,
          info: {
            lamports: 1_000_000_000,
            data: Buffer.alloc(0),
            owner: SYSTEM_PROGRAM_ID,
            executable: false,
          },
        },
      ]
    );

    // Setup authority
    const authorityProvider = new BankrunProvider(context);
    anchor.setProvider(authorityProvider);
    authorityProgram = new Program(IDL as Vesting, authorityProvider);
    authority = authorityProvider.wallet.payer;

    // Create SPL token mint controlled by authority
    mint = await createMint(
      context.banksClient,
      authority,
      authority.publicKey,
      null,
      mintDecimals
    );

    // Setup beneficiary program
    const beneficiaryProvider = new BankrunProvider(context);
    beneficiaryProvider.wallet = new NodeWallet(beneficiary);
    scheduleProgram = new Program(IDL as Vesting, beneficiaryProvider);

    // Derive PDAs
    [vestingAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vesting_authority"), Buffer.from(companyName)],
      authorityProgram.programId
    );

    [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vesting_treasury"), Buffer.from(companyName)],
      authorityProgram.programId
    );

    [vestingSchedulePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vesting_schedule"),
        beneficiary.publicKey.toBuffer(),
        vestingAuthorityPda.toBuffer(),
      ],
      authorityProgram.programId
    );
  });

  it("creates authority vesting account", async () => {
    try {
      const tx = await authorityProgram.methods
        .createVestingAuthority(companyName)
        .accounts({
          authority: authority.publicKey,
          tokenMint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: "confirmed" });

      console.log(
        "Create authority vesting account transaction signature:",
        tx
      );

      const vestingAuthority =
        await authorityProgram.account.vestingAuthority.fetch(
          vestingAuthorityPda
        );

      expect(vestingAuthority.authority.toBase58()).toBe(
        authority.publicKey.toBase58()
      );

      console.log(
        "Authority vesting account:",
        JSON.stringify(vestingAuthority, null, 2)
      );
    } catch (error: any) {
      console.error("Create authority vesting account failed:", error);
      throw new Error("Create authority vesting account failed");
    }
  });

  it("funds treasury token account", async () => {
    try {
      const tx = await mintTo(
        context.banksClient,
        authority,
        mint,
        treasuryPda,
        authority,
        treasuryTokenAllocation
      );

      console.log("Mint treasury token account transaction signature:", tx);
    } catch (error: any) {
      console.error("Funding treasury token account failed:", error);
      throw new Error("Funding treasury token account failed");
    }
  });

  it("creates beneficiary vesting account", async () => {
    try {
      const tx = await authorityProgram.methods
        .createVestingSchedule(
          new BN(startTime),
          new BN(endTime),
          new BN(cliffTime),
          new BN(beneficiaryTokenAllocation)
        )
        .accounts({
          beneficiary: beneficiary.publicKey,
          vestingAuthority: vestingAuthorityPda,
        })
        .rpc({ commitment: "confirmed", skipPreflight: true });

      console.log("Create beneficiary account transaction signature:", tx);

      const vestingSchedule =
        await authorityProgram.account.vestingSchedule.fetch(
          vestingSchedulePda
        );
      expect(vestingSchedule.totalAmount.toNumber()).toBe(
        beneficiaryTokenAllocation
      );

      console.log(
        "Beneficiary vesting account:",
        JSON.stringify(vestingSchedule, null, 2)
      );
    } catch (error: any) {
      console.error("Create beneficiary vesting account failed:", error);
      throw new Error("Create beneficiary vesting account failed");
    }
  });

  it("fails to claim tokens before cliff time", async () => {
    try {
      const tx = await scheduleProgram.methods
        .claim(companyName)
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

  it("allows beneficiary to claim vested tokens after cliff time", async () => {
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
      const tx = await scheduleProgram.methods
        .claim(companyName)
        .accounts({
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: "confirmed" });

      const beneficiaryBalance = await context.banksClient.getBalance(
        beneficiary.publicKey
      );
      expect(beneficiaryBalance).toBeGreaterThan(0); // Ensure tokens were claimed

      console.log("Claim tokens transaction signature", tx);
    } catch (error: any) {
      console.error("Claim tokens failed unexpectedly:", error);
      throw new Error("Claim should have succeeded after cliff time");
    }
  });

  it("fails when non-authority tries to revoke a schedule", async () => {
    try {
      const tx = await scheduleProgram.methods
        .revokeSchedule()
        .accounts({
          authority: beneficiary.publicKey,
          vestingAuthority: vestingAuthorityPda,
          vestingSchedule: vestingSchedulePda,
        })
        .signers([beneficiary])
        .rpc({ commitment: "confirmed" });

      console.error("Beneficiary revoke succeeded unexpectedly:", tx);
      fail("Revoke should have failed when called by non-authority");
    } catch (error: any) {
      console.log("Error when beneficiary tries to revoke:", error);
      expect(error.message).toContain("ConstraintHasOne");
    }
  });

  it("allows authority to revoke a schedule", async () => {
    try {
      const tx = await authorityProgram.methods
        .revokeSchedule()
        .accounts({
          authority: authority.publicKey,
          vestingAuthority: vestingAuthorityPda,
          vestingSchedule: vestingSchedulePda,
        })
        .signers([authority])
        .rpc({ commitment: "confirmed" });

      const vestingSchedule =
        await scheduleProgram.account.vestingSchedule.fetch(vestingSchedulePda);

      expect(vestingSchedule.revokedAt).not.toBeNull();

      console.log("Schedule successfully revoked:", tx);
    } catch (error: any) {
      console.error("Revoke schedule failed unexpectedly:", error);
      throw new Error("Schedule should have been revoked");
    }
  });

  it("fails to revoke an already revoked schedule", async () => {
    try {
      const vestingScheduleBefore =
        await authorityProgram.account.vestingSchedule.fetch(
          vestingSchedulePda
        );

      expect(vestingScheduleBefore.revokedAt).not.toBeNull();
      console.log(
        "Confirmed schedule is already revoked at:",
        vestingScheduleBefore?.revokedAt?.toString()
      );

      const tx = await scheduleProgram.methods
        .revokeSchedule()
        .accounts({ authority: authority.publicKey })
        .signers([authority])
        .rpc({ commitment: "confirmed" });

      console.error("Second revoke succeeded unexpectedly:", tx);
      fail("Revoke should have failed for an already revoked schedule");
    } catch (error: any) {
      console.log(
        "Revoke failed as expected for an already revoked schedule:",
        error.message
      );
    }
  });
});
