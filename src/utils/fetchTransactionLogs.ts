import { Connection } from "@solana/web3.js";

export async function fetchTransactionLogs(
  connection: Connection,
  signature: string
) {
  const txDetails = await connection.getTransaction(signature, {
    commitment: "confirmed",
  });

  if (txDetails?.meta?.logMessages) {
    console.log("Transaction Logs:");
    txDetails.meta.logMessages.forEach((log) => console.log(log));
  } else {
    console.error("No logs found for transaction:", signature);
  }
}
