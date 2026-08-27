import { PayOnceLedger } from "../models/PayOnceLedger";
import mongoose from "mongoose";

export async function hasAlreadyPaid(
  idCardId: string | mongoose.Types.ObjectId,
  level: number,
  options: { session?: mongoose.ClientSession } = {}
): Promise<boolean> {
  const record = await PayOnceLedger.findOne({ idCardId, level }).session(options.session || null).exec();
  return !!record;
}

export async function recordPayment(
  idCardId: string | mongoose.Types.ObjectId,
  level: number,
  paidVia: string,
  options: { session?: mongoose.ClientSession } = {}
): Promise<any> {
  const newRecordArr = await PayOnceLedger.create(
    [
      {
        idCardId,
        level,
        paidVia,
      },
    ],
    { session: options.session }
  );
  return newRecordArr[0];
}
