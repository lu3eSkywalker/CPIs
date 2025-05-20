import { test, expect } from "bun:test";
import path from "path";
import { LiteSVM } from "litesvm";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from "@solana/web3.js";

const svm = new LiteSVM();

test("one transfer", () => {
  const contractPubkey = PublicKey.unique();
  // Loading our contract to the local SVM
  svm.addProgramFromFile(contractPubkey, "./cpi_binary2.so");

  const payer = new Keypair();
  svm.airdrop(payer.publicKey, BigInt(LAMPORTS_PER_SOL));
  const dataAccount = new Keypair();
  const blockhash = svm.latestBlockhash();
  const ixs = [
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: dataAccount.publicKey,
      lamports: Number(svm.minimumBalanceForRentExemption(BigInt(4))),
      space: 4,
      programId: contractPubkey,
    }),
  ];

  // With this transaction we create a new dataAccount
  const tx = new Transaction();
  tx.recentBlockhash = svm.latestBlockhash();
  tx.feePayer = payer.publicKey;
  tx.add(...ixs);
  tx.sign(payer, dataAccount);
  svm.sendTransaction(tx);
  const balanceAfter = svm.getBalance(dataAccount.publicKey);
  expect(balanceAfter).toBe(svm.minimumBalanceForRentExemption(BigInt(4)));

  const ix2 = new TransactionInstruction({
    keys: [
      { pubkey: dataAccount.publicKey, isSigner: false, isWritable: true },
    ],
    programId: contractPubkey,
    data: Buffer.from(""),
  });

  // This is the transaction sent to double the integer
  function doubleIt() {
    const blockhash = svm.latestBlockhash();
    const tx2 = new Transaction();
    tx2.recentBlockhash = blockhash;
    tx2.feePayer = payer.publicKey;
    tx2.add(ix2);
    tx2.sign(payer);
    svm.sendTransaction(tx2);
    svm.expireBlockhash();
  }

  doubleIt();
  doubleIt();
  doubleIt();
  doubleIt();

  // Checking the data on the blockchain
  const newDataAcc = svm.getAccount(dataAccount.publicKey);
  console.log("This is the counter after 2nd transaction: ", newDataAcc?.data);

  expect(newDataAcc?.data[0]).toBe(8);
  expect(newDataAcc?.data[1]).toBe(0);
  expect(newDataAcc?.data[2]).toBe(0);
  expect(newDataAcc?.data[3]).toBe(0);
});
