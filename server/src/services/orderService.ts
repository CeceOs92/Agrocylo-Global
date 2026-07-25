import { prisma } from "../config/database.js";
import { ApiError, NotFoundError } from "../http/errors.js";
import logger from "../config/logger.js";

const ORDER_INCLUDE = {
  product: true,
  buyerUser: true,
  sellerUser: true,
} as const;

const ORDER_BY_CREATED_DESC = { createdAt: "desc" } as const;

export class OrderService {
  static async getAll() {
    try {
      return await prisma.order.findMany({
        include: ORDER_INCLUDE,
        orderBy: ORDER_BY_CREATED_DESC,
      });
    } catch (error) {
      logger.error("Failed to fetch orders", { error });
      throw new ApiError(500, "Internal Server Error", "Failed to fetch orders");
    }
  }

  static async getByOrderId(orderIdOnChain: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { orderIdOnChain },
        include: ORDER_INCLUDE,
      });
      if (!order) {
        throw new NotFoundError("Order", orderIdOnChain);
      }
      return order;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error("Failed to fetch order by ID", { error, orderIdOnChain });
      throw new ApiError(500, "Internal Server Error", "Failed to fetch order");
    }
  }

  static async getByBuyerAddress(buyerAddress: string) {
    try {
      return await prisma.order.findMany({
        where: { buyerAddress },
        include: ORDER_INCLUDE,
        orderBy: ORDER_BY_CREATED_DESC,
      });
    } catch (error) {
      logger.error("Failed to fetch orders by buyer", { error, buyerAddress });
      throw new ApiError(500, "Internal Server Error", "Failed to fetch buyer orders");
    }
  }

  static async getByFarmerAddress(sellerAddress: string) {
    try {
      return await prisma.order.findMany({
        where: { sellerAddress },
        include: ORDER_INCLUDE,
        orderBy: ORDER_BY_CREATED_DESC,
      });
    } catch (error) {
      logger.error("Failed to fetch orders by farmer", { error, sellerAddress });
      throw new ApiError(500, "Internal Server Error", "Failed to fetch farmer orders");
    }
  }

  static async getSellerStats(sellerAddress: string) {
    try {
      const [totalOrders, completedCount, refundedCount, disputedCount] =
        await Promise.all([
          prisma.order.count({ where: { sellerAddress } }),
          prisma.order.count({ where: { sellerAddress, status: "COMPLETED" } }),
          prisma.order.count({ where: { sellerAddress, status: "REFUNDED" } }),
          prisma.dispute.count({
            where: {
              order: { sellerAddress },
            },
          }),
        ]);

      if (totalOrders === 0) {
        return {
          totalOrders: 0,
          successRate: 100,
          disputeRate: 0,
          refundRatio: 0,
        };
      }

      return {
        totalOrders,
        successRate: (completedCount / totalOrders) * 100,
        disputeRate: (disputedCount / totalOrders) * 100,
        refundRatio: (refundedCount / totalOrders) * 100,
      };
    } catch (error) {
      logger.error("Failed to fetch seller stats", { error, sellerAddress });
      throw new ApiError(500, "Internal Server Error", "Failed to fetch seller statistics");
    }
  }
}
