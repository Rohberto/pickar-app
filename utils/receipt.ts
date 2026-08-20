// Shared receipt generation for both the user and driver "delivery complete"
// screens. Renders a simple branded HTML invoice and hands it to
// expo-print (HTML → PDF) then expo-sharing (native share/save sheet) —
// this is what makes "Download receipt" produce a real file instead of
// just firing a text-only Share.share() message.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export type ReceiptData = {
  deliveryId: string;
  date?: string;
  price: number | string;
  pickupLabel: string;
  destLabel: string;
  recipientName?: string;
  recipientPhone?: string;
  driverName?: string;
  driverVehicle?: string;
  driverPlate?: string;
  distanceKm?: number | string | null;
  weightKg?: number | string | null;
  packageType?: string | null;
  rideType?: string | null;
  fareBreakdown?: Record<string, number> | null;
};

const money = (n: number | string | undefined | null) =>
  `₦${Math.round(Number(n) || 0).toLocaleString()}`;

const FRIENDLY_LABEL: Record<string, string> = {
  baseFee: 'Base fare',
  distanceFee: 'Distance fee',
  weightFee: 'Weight fee',
  zoneFee: 'Zone fee',
  'Express Premium': 'Express premium',
  'Scheduled Discount': 'Scheduled discount',
};

export function buildReceiptHtml(data: ReceiptData): string {
  const {
    deliveryId, date, price, pickupLabel, destLabel,
    recipientName, driverName, driverVehicle, driverPlate,
    distanceKm, weightKg, packageType, rideType, fareBreakdown,
  } = data;

  const dateLabel = date
    ? new Date(date).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
    : new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

  const breakdownRows = fareBreakdown && Object.keys(fareBreakdown).length
    ? Object.entries(fareBreakdown)
        .filter(([, v]) => typeof v === 'number' && v !== 0)
        .map(([label, value]) => `
          <tr>
            <td class="muted">${FRIENDLY_LABEL[label] || label}</td>
            <td class="right">${value < 0 ? '-' : ''}${money(Math.abs(value))}</td>
          </tr>
        `).join('')
    : '';

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 32px; color: #1a1a1a; }
        .header { text-align: center; margin-bottom: 28px; }
        .brand { font-size: 22px; font-weight: 700; color: #9B1515; letter-spacing: 0.5px; }
        .tagline { font-size: 12px; color: #888; margin-top: 4px; }
        .badge { display: inline-block; margin-top: 14px; padding: 6px 16px; background: #f0f8f4; color: #1a8a4c; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .card { border: 1px solid #eee; border-radius: 12px; padding: 20px 24px; margin-top: 20px; }
        .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f2f2f2; font-size: 13px; }
        .row:last-child { border-bottom: none; }
        .muted { color: #777; }
        .label { font-size: 11px; text-transform: uppercase; color: #999; letter-spacing: 0.5px; margin-bottom: 10px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        table td { padding: 6px 0; }
        .right { text-align: right; }
        .total-row td { padding-top: 12px; border-top: 1px solid #eee; font-size: 15px; font-weight: 700; }
        .footer { text-align: center; margin-top: 32px; font-size: 11px; color: #aaa; }
        .id { text-align: center; font-size: 11px; color: #bbb; margin-top: 4px; letter-spacing: 0.5px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">PICKAR</div>
        <div class="tagline">Delivery Receipt</div>
        <div class="badge">✓ Delivered</div>
      </div>

      <div class="card">
        <div class="label">Trip</div>
        <div class="row"><span class="muted">Date</span><span>${dateLabel}</span></div>
        <div class="row"><span class="muted">Pickup</span><span style="max-width:60%;text-align:right">${pickupLabel || '—'}</span></div>
        <div class="row"><span class="muted">Delivered to</span><span style="max-width:60%;text-align:right">${destLabel || '—'}</span></div>
        ${recipientName ? `<div class="row"><span class="muted">Recipient</span><span>${recipientName}</span></div>` : ''}
        ${rideType ? `<div class="row"><span class="muted">Ride type</span><span style="text-transform:capitalize">${String(rideType).replace('_', ' ')}</span></div>` : ''}
        ${distanceKm ? `<div class="row"><span class="muted">Distance</span><span>${distanceKm} km</span></div>` : ''}
        ${weightKg ? `<div class="row"><span class="muted">Weight</span><span>${weightKg} kg</span></div>` : ''}
        ${packageType ? `<div class="row"><span class="muted">Package</span><span style="text-transform:capitalize">${packageType.replace('_', ' ')}</span></div>` : ''}
        ${driverName ? `<div class="row"><span class="muted">Driver</span><span>${driverName}${driverVehicle ? ` · ${driverVehicle}` : ''}${driverPlate ? ` (${driverPlate})` : ''}</span></div>` : ''}
      </div>

      <div class="card">
        <div class="label">Fare</div>
        <table>
          ${breakdownRows}
          <tr class="total-row"><td>Total paid</td><td class="right">${money(price)}</td></tr>
        </table>
      </div>

      <div class="footer">Thank you for riding with Pickar.</div>
      <div class="id">Receipt ref: ${deliveryId}</div>
    </body>
  </html>
  `;
}

// Generates a PDF from the receipt HTML and hands it to the native
// share/save sheet. Throws on failure — callers should catch and show
// their own error UI (Print/Sharing errors are rare but not impossible,
// e.g. sharing unavailable on some Android emulators).
export async function downloadReceipt(data: ReceiptData): Promise<void> {
  const html = buildReceiptHtml(data);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Pickar Receipt',
      UTI: 'com.adobe.pdf',
    });
  }
  // If sharing isn't available on this device, the PDF still exists at
  // `uri` in cache — silently succeeding without a share sheet is fine
  // since there's no in-app file browser to point the user to instead.
}
