-- PREVIEW: Verifică ce ștergi pentru clientul Romeo în luna curentă (octombrie 2025)
select id, platform, metric_type, date, created_at, metrics->>'totalOrders' as total_orders
from metrics_snapshots
where client_id = '8cdae7bc-8312-4acf-958e-0113615e8776'
  and platform = 'woocommerce'
  and date::date between '2025-10-01' and '2025-10-31'
order by date, created_at;

-- DELETE: Șterge toate snapshoturile WooCommerce din luna curentă pentru clientul Romeo
delete from metrics_snapshots
where client_id = '8cdae7bc-8312-4acf-958e-0113615e8776'
  and platform = 'woocommerce'
  and date::date between '2025-10-01' and '2025-10-31';
