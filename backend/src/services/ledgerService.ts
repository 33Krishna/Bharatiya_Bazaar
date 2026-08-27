import { LedgerEntry } from "../models/LedgerEntry";
import mongoose from "mongoose";

export interface CreateEntryParams {
  walletId?: mongoose.Types.ObjectId;
  systemWallet?: string;
  type: string;
  amountPaise: number;
  balanceBeforePaise: number;
  balanceAfterPaise: number;
  source: string;
  referenceId?: string | null;
  description?: string | null;
  direction?: string;
  notes?: string;
}

export async function createEntry(
  data: CreateEntryParams,
  options: { session?: mongoose.ClientSession } = {}
): Promise<any> {
  const newEntryArr = await LedgerEntry.create(
    [
      {
        walletId: data.walletId,
        systemWallet: data.systemWallet,
        type: data.type,
        amountPaise: data.amountPaise,
        balanceBeforePaise: data.balanceBeforePaise,
        balanceAfterPaise: data.balanceAfterPaise,
        source: data.source,
        referenceId: data.referenceId || undefined,
        description: data.description || undefined,
        direction: data.direction,
        notes: data.notes,
      },
    ],
    { session: options.session }
  );
  return newEntryArr[0];
}
