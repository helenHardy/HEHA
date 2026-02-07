export function generateReceiptHTML(order, items) {
  const date = new Date().toLocaleString('es-BO');
  const total = order.total_amount.toFixed(2);

  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 2px 0;">${item.quantity} x ${item.product.name}</td>
      <td style="text-align: right;">${(item.quantity * item.product.price).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: 'Courier New', monospace; width: 300px; padding: 10px; font-size: 12px;">
      <div style="text-align: center; margin-bottom: 15px;">
        <h2 style="font-size: 28px; font-weight: 900; margin: 0; letter-spacing: -1px;">HEHA</h2>
      </div>
      
      <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
      
      <p>Ticket #: ${order.id}</p>
      <p>Fecha: ${date}</p>
      ${order.customer_name ? `<p>Cliente: <strong>${order.customer_name.toUpperCase()}</strong></p>` : ''}
      <p>Atendido por: ${order.cashier_name || 'Cajero'}</p>
      <p>Tipo: <strong>${order.order_type.toUpperCase()}</strong></p>
      <p>Pago: <strong>${(order.payment_method || 'Efectivo').toUpperCase()}</strong></p>
      
      ${order.order_type === 'whatsapp' ? `
      <div style="border-top: 1px dashed black; border-bottom: 1px dashed black; padding: 5px 0; margin: 5px 0;">
        <p><strong>DATOS DELIVERY:</strong></p>
        <p>Tel: ${order.customer_phone || 'N/A'}</p>
        <p>Ubicación: ${order.delivery_location ? 'Sí' : 'No'}</p>
      </div>
      ` : ''}
      
      <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
      
      <table style="width: 100%;">
        ${itemsHtml}
      </table>
      
      <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
      
      <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold;">
        <span>TOTAL:</span>
        <span>Bs. ${total}</span>
      </div>
      ${order.advance_amount > 0 ? `
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 2px;">
        <span>Adelanto:</span>
        <span>Bs. ${order.advance_amount.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; border-top: 1px dashed black; margin-top: 2px; padding-top: 2px;">
        <span>SALDO:</span>
        <span>Bs. ${(order.total_amount - order.advance_amount).toFixed(2)}</span>
      </div>
      ` : ''}
      
      <div style="margin-top: 20px; text-align: center;">
        <p>¡Gracias por su preferencia!</p>
        <p>No válido para crédito fiscal</p>
      </div>
    </div>
  `;
}

export function printTicket(html) {
  const printWindow = window.open('', '', 'width=400,height=600');
  printWindow.document.write('<html><head><title>Imprimir Ticket</title></head><body>');
  printWindow.document.write(html);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}
export function generateCloseReportHTML(report, cashierName, role) {
  const date = new Date().toLocaleString('es-BO');
  const rec = report.reconciliation || {};
  const initial = report.initialCash || 0;
  // If role is undefined, default to 'cajero' for safety
  const isAdmin = role === 'admin';

  const productsHtml = report.topProducts.map(p => `
    <tr>
      <td style="padding: 2px 0;">${p.name}</td>
      <td style="text-align: right;">${p.qty}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: 'Courier New', monospace; width: 300px; padding: 10px; font-size: 12px;">
      <div style="text-align: center; margin-bottom: 10px;">
        <h2 style="font-size: 16px; margin: 0;">REPORTE DE CIERRE CAJA</h2>
        <p style="margin: 2px 0;">"EL SABOR"</p>
        <p style="margin: 2px 0;">Fecha: ${date}</p>
        <p style="margin: 2px 0;">Cajero: ${cashierName}</p>
      </div>
      
      <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
      
      <h3 style="font-size: 14px;">ARQUEO DE CAJA</h3>
      <div style="display: flex; justify-content: space-between;">
        <span>Fondo Inicial:</span>
        <span>Bs. ${initial.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>(+) Venta Efectivo:</span>
        <span>Bs. ${(rec.salesCash || 0).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>(-) Retiros Admin:</span>
        <span>Bs. ${(report.totalWithdrawals || 0).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; border-top: 1px solid black; padding-top:2px;">
        <span style="font-weight:bold;">(=) ESPERADO EN CAJA:</span>
        <span style="font-weight:bold;">Bs. ${(rec.expectedCash || 0).toFixed(2)}</span>
      </div>
       <div style="display: flex; justify-content: space-between; margin-top: 5px;">
        <span style="font-weight:bold;">EFECTIVO REAL:</span>
        <span style="font-weight:bold; border: 1px solid black; padding: 0 4px;">Bs. ${(rec.finalCash || 0).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 2px;">
        <span>Diferencia:</span>
        <span>Bs. ${(rec.difference || 0).toFixed(2)}</span>
      </div>

       <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>

      <h3 style="font-size: 14px;">OTROS PAGOS</h3>
       <div style="display: flex; justify-content: space-between;">
        <span>Venta QR/Bancos:</span>
        <span>Bs. ${(rec.salesDigital || 0).toFixed(2)}</span>
      </div>

      <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
      
      <div style="display: flex; justify-content: space-between; font-weight: bold;">
        <span>VENTA TOTAL DEL DÍA:</span>
        <span>Bs. ${report.totalSales.toFixed(2)}</span>
      </div>
      
      ${isAdmin ? `
      <div style="display: flex; justify-content: space-between;">
        <span>Capital (Costo):</span>
        <span>Bs. ${report.totalCost.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: bold;">
        <span>GANANCIA NETA:</span>
        <span>Bs. ${report.profit.toFixed(2)}</span>
      </div>
      ` : ''}

      <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
      
      <h3 style="font-size: 14px;">PRODUCTOS VENDIDOS</h3>
      <table style="width: 100%;">
        ${productsHtml}
      </table>
      
      <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
      
      <div style="margin-top: 20px; text-align: center;">
        <p>--- CIERRE EXITOSO ---</p>
      </div>
    </div>
  `;
}
