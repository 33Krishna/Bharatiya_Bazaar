import { IMember } from "../models/Member";
import { IVendor } from "../models/Vendor";
import { IAdminUser } from "../models/AdminUser";

declare global {
  namespace Express {
    interface Request {
      member?: IMember | null;
      admin?: IAdminUser | null;
      vendor?: IVendor | null;
      loginContext?: {
        loginCardId: string | null;
        cardId?: string | null;
        cardNumber: string;
        loginCardNumber: string;
        cardType: string;
        loginCardType: string;
        isSubCard: boolean;
        ownerMemberCode: string | null;
      } | null;
    }
  }
}
