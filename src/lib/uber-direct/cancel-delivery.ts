import { uberRequest } from "./client";

/**
 * Cancel an in-flight Uber delivery.
 *
 * Wraps `POST /customers/{customer_id}/deliveries/{delivery_id}/cancel`.
 * Called from:
 *   - Creator declines an order they can't fulfill (out of
 *     stock, kitchen closed)
 *   - Customer cancels pre-pickup
 *   - The order-cleanup cron when a delivery has been pending
 *     too long with no courier assigned
 *
 * Uber Direct allows cancellation while status is `pending` or
 * `pickup`. Past that (food in the courier's bag), cancellation
 * isn't allowed via API; the delivery has to complete or be
 * disputed via Uber support.
 *
 * Returns void on success. The caller is responsible for the
 * Stripe refund logic — this function only releases the
 * courier.
 */
export async function cancelDelivery(deliveryId: string): Promise<void> {
  await uberRequest<unknown>({
    op: "cancel-delivery",
    method: "POST",
    path: `/customers/{customer_id}/deliveries/${deliveryId}/cancel`,
    body: {},
  });
}
