<![CDATA[/**
 * RuralPOS — Sync Service (Simplified Sample)
 *
 * This is a simplified excerpt demonstrating the core offline-first
 * sync pattern used in RuralPOS. The full implementation includes
 * support for orders, inventory, carcass records, freezer items,
 * audit logs, and background sync via expo-background-fetch.
 *
 * Architecture:
 *   Local SQLite ←→ SyncService ←→ Supabase (Postgres + Realtime)
 */

    import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (credentials loaded from environment)
const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!
    );

/**
 * Subscribe to real-time changes from other devices (downstream sync).
 * Changes are scoped to the active tenant for SaaS data isolation.
 */
function startDownstreamSync(tenantId: string) {
    supabase
        .channel(`tenant_${tenantId}:orders`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'orders',
                filter: `tenant_id=eq.${tenantId}`,
            },
            async (payload) => {
                // Upsert the remote order into local SQLite
                await upsertLocalOrder(payload.new);
                // Trigger UI refresh via Zustand store
                refreshOrdersUI();
            }
        )
        .subscribe();
}

/**
 * Push a locally created order upstream to Supabase.
 * If offline, the operation is queued for later retry.
 */
async function pushOrderUpstream(order: Order, items: OrderItem[]) {
    try {
        const { error } = await supabase
            .from('orders')
            .upsert([order], { onConflict: 'id' });

        if (error) throw error;

        if (items.length > 0) {
            await supabase
                .from('order_items')
                .upsert(items, { onConflict: 'id' });
        }

        console.log('✅ Synced order:', order.id);
    } catch (e) {
        // Network failure → queue for background retry
        await enqueueForSync('UPSERT_ORDER', { order, items });
        console.log('📦 Queued for offline sync:', order.id);
    }
}

/**
 * Process the offline sync queue — called on reconnection
 * and every 15 minutes via expo-background-fetch.
 */
async function processSyncQueue() {
    const queue = await getPendingSyncItems();

    for (const item of queue) {
        try {
            const payload = JSON.parse(item.payload);

            switch (item.operation) {
                case 'UPSERT_ORDER':
                    await pushOrderUpstream(payload.order, payload.items);
                    break;
                case 'UPSERT_INVENTORY':
                    await pushInventoryUpstream(payload);
                    break;
                // ... other operation types
            }

            await removeSyncItem(item.id);
        } catch (e) {
            // Still offline — stop processing to avoid spamming
            break;
        }
    }
}
]]>
