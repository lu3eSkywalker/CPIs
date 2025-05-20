import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { test, expect } from "bun:test";
import { LiteSVM } from "litesvm";


test("CPI works as expected", async() => {


    let svm = new LiteSVM();

    let doubleContract = PublicKey.unique();
    let cpiContract = PublicKey.unique();

    svm.addProgramFromFile(doubleContract, "./double-contract.so")
    svm.addProgramFromFile(cpiContract, "./cpi_contract_binary.so")

    let userAcc = new Keypair();
    let dataAcc = new Keypair();

    svm.airdrop(userAcc.publicKey, BigInt(1000_000_000));

    createDataAccOnChain(svm, dataAcc, userAcc, doubleContract);

    function doubleIt() {
        let ix = new TransactionInstruction({
            keys: [
                { pubkey: dataAcc.publicKey, isSigner: true, isWritable: true },
                { pubkey: doubleContract, isSigner: false, isWritable: false }
            ],
            programId: cpiContract,
            data: Buffer.from(""),
        });
    
        const blockhash = svm.latestBlockhash();
        let transaction = new Transaction().add(ix);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userAcc.publicKey;
        transaction.sign(userAcc, dataAcc);
    
        const res = svm.sendTransaction(transaction);
        console.log(res.toString());
        svm.expireBlockhash();
    }

    doubleIt();
    doubleIt();
    doubleIt();
    doubleIt();

    const dataAccountData = svm.getAccount(dataAcc.publicKey);
    expect(dataAccountData?.data[0]).toBe(8);
    expect(dataAccountData?.data[1]).toBe(0);
    expect(dataAccountData?.data[2]).toBe(0);
    expect(dataAccountData?.data[3]).toBe(0);
})

function createDataAccOnChain(svm: LiteSVM, dataAccount: Keypair, payer: Keypair, contractPubkey: PublicKey) {
    const blockchain = svm.latestBlockhash();
    const ixs = [
        SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: dataAccount.publicKey,
            lamports: Number(svm.minimumBalanceForRentExemption(BigInt(4))),
            space: 4,
            programId: contractPubkey
        }),
    ];

    const tx = new Transaction();
    tx.recentBlockhash = blockchain;
    tx.feePayer = payer.publicKey;
    tx.add(...ixs);
    tx.sign(payer,dataAccount);
    svm.sendTransaction(tx);
}