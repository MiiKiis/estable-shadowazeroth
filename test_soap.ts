import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getSoapUrl } from './src/lib/db';

export {};

async function testSoap() {
  const soapEndpoint = await getSoapUrl();
  const soapUser = process.env.ACORE_SOAP_USER;
  const soapPassword = process.env.ACORE_SOAP_PASSWORD;

  console.log('Testing SOAP at:', soapEndpoint);
  console.log('User:', soapUser);

  const command = '.server info';
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
    });
    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response text:', text);
    process.exit(0);
  } catch (err) {
    console.error('SOAP Error:', err);
    process.exit(1);
  }
}

testSoap();
