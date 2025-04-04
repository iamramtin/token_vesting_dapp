import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Cluster, PublicKey } from "@solana/web3.js";
import VestingIDL from "../target/idl/vesting.json";
import type { Vesting } from "../target/types/vesting";

export { Vesting, VestingIDL };

export const VESTING_PROGRAM_ID = new PublicKey(VestingIDL.address);

export const ANCHOR_DISCRIMINATOR_SIZE = 8;

export function getVestingProgram(
  provider: AnchorProvider,
  address?: PublicKey
) {
  return new Program(
    {
      ...VestingIDL,
      address: address ? address.toBase58() : VestingIDL.address,
    } as Vesting,
    provider
  );
}

export function getVestingProgramId(cluster: Cluster) {
  switch (cluster) {
    case "devnet":
    case "testnet":
      // This is the program ID for the Vesting program on devnet and testnet.
      return new PublicKey("coUnmi3oBUtwtd9fjeAvSsJssXh5A5xyPbhpewyzRVF");
    case "mainnet-beta":
    default:
      return VESTING_PROGRAM_ID;
  }
}
