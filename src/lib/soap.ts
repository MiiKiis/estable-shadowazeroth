import { Buffer } from 'buffer';
import { getSoapUrl } from './db';

/**
 * Ejecuta un comando en el servidor AzerothCore vía SOAP.
 */
export async function executeSoapCommand(command: string) {
  const soapEndpoint = await getSoapUrl();
  const soapUser = process.env.ACORE_SOAP_USER;
  const soapPassword = process.env.ACORE_SOAP_PASSWORD;

  // Si no está configurado SOAP, lo ignoramos para no romper el flujo.
  if (!soapEndpoint || !soapUser || !soapPassword) {
    console.warn('⚠️ SOAP no configurado. El comando no se ejecutará:', command);
    return { skipped: true };
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="urn:AC">
  <SOAP-ENV:Body>
    <ns1:executeCommand>
      <command>${command}</command>
    </ns1:executeCommand>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

  const auth = Buffer.from(`${soapUser}:${soapPassword}`).toString('base64');
  
  try {
    const response = await fetch(soapEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'executeCommand',
      },
      body: xml,
      cache: 'no-store',
    });

    const text = await response.text();
    
    if (!response.ok) {
      throw new Error(`SOAP HTTP ${response.status}: ${text}`);
    }

    // AzerothCore a veces devuelve un fault dentro de un 200 OK.
    if (/faultcode|SOAP-ENV:Fault|<result>false<\/result>/i.test(text)) {
      throw new Error(`SOAP command failed: ${text}`);
    }

    return { skipped: false, response: text };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('❌ Error ejecutando SOAP:', errorMsg);
    throw error;
  }
}
