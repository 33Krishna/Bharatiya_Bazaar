import { Wallet } from "../models/Wallet";
import { LedgerEntry } from "../models/LedgerEntry";
import * as ledgerService from "./ledgerService";
import mongoose from "mongoose";

export interface TransactionResult {
  wallet: any;
  ledger: any;
}

export async function credit(
  memberId: string | mongoose.Types.ObjectId,
  amountPaise: number,
  source: string,
  referenceId: string | null = null,
  description: string | null = null,
  options: { session?: mongoose.ClientSession } = {}
): Promise<TransactionResult | null> {
  if (amountPaise <= 0) return null;

  // Atomic findOneAndUpdate with $inc handles concurrent updates cleanly
  const updatedWallet = await Wallet.findOneAndUpdate(
    { memberId },
    { $inc: { balancePaise: amountPaise } },
    { new: true, upsert: true, session: options.session }
  );

  const balanceAfter = updatedWallet.balancePaise;
  const balanceBefore = balanceAfter - amountPaise;

  const ledger = await ledgerService.createEntry(
    {
      walletId: updatedWallet.id,
      type: "CREDIT",
      amountPaise,
      balanceBeforePaise: balanceBefore,
      balanceAfterPaise: balanceAfter,
      source,
      referenceId,
      description,
    },
    { session: options.session }
  );

  return { wallet: updatedWallet, ledger };
}

export async function debit(
  memberId: string | mongoose.Types.ObjectId,
  amountPaise: number,
  source: string,
  referenceId: string | null = null,
  description: string | null = null,
  options: { session?: mongoose.ClientSession } = {}
): Promise<TransactionResult | null> {
  if (amountPaise <= 0) return null;

  // Optimistic debit: decrement balance only if it is >= amountPaise
  const updatedWallet = await Wallet.findOneAndUpdate(
    { memberId, balancePaise: { $gte: amountPaise } },
    { $inc: { balancePaise: -amountPaise } },
    { new: true, session: options.session }
  );

  if (!updatedWallet) {
    throw new Error(`Insufficient funds for member ${memberId}.`);
  }

  const balanceAfter = updatedWallet.balancePaise;
  const balanceBefore = balanceAfter + amountPaise;

  const ledger = await ledgerService.createEntry(
    {
      walletId: updatedWallet.id,
      type: "DEBIT",
      amountPaise,
      balanceBeforePaise: balanceBefore,
      balanceAfterPaise: balanceAfter,
      source,
      referenceId,
      description,
    },
    { session: options.session }
  );

  return { wallet: updatedWallet, ledger };
}

export async function getWalletBalance(memberId: string | mongoose.Types.ObjectId): Promise<any> {
  const wallet = await Wallet.findOne({ memberId });
  if (!wallet) {
    return { balancePaise: 0 };
  }
  return wallet;
}

export async function getLedgerHistory(
  memberId: string | mongoose.Types.ObjectId,
  limit = 50,
  offset = 0
): Promise<any[]> {
  const wallet = await Wallet.findOne({ memberId });
  if (!wallet) {
    return [];
  }

  return await LedgerEntry.find({ walletId: wallet.id })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .exec();
}
