export function generateWhatsAppMessage(order, items) {
    const total = order.total_amount.toFixed(2);
    const advance = (order.advance_amount || 0).toFixed(2);
    const balance = (order.total_amount - (order.advance_amount || 0)).toFixed(2);

    const itemsText = items.map(i => `${i.quantity}x ${i.product.name}`).join('\n');
    const location = order.delivery_location || 'Solicitar ubicación';

    let paymentInfo = '';
    if (order.advance_amount > 0) {
        paymentInfo = `\n*Adelanto:* Bs. ${advance}\n*SALDO A PAGAR:* Bs. ${balance}`;
    } else {
        paymentInfo = `\n*Pago:* ${order.payment_method === 'qr' ? 'QR' : (order.payment_method === 'pendiente' ? 'Pendiente' : 'Efectivo')}`;
    }

    return `*NUEVO PEDIDO DELIVERY* 🛵
  
*Cliente:* ${order.customer_phone}
*Pedido:*
${itemsText}

*Total:* Bs. ${total}${paymentInfo}
*Ubicación:* ${location}

_Por favor confirmar recepción._`;
}
