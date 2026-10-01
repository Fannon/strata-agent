/** Independent SQL calculations audit the controller's in-memory answer oracles. No model calls. */
import {Database} from 'bun:sqlite';
import assert from 'node:assert/strict';
import {makeWorld} from './fixture.ts';
import {tasks,development,oracle} from './protocol.ts';
let checked=0;
for(let variant=0;variant<3;variant++){
 const data=makeWorld('audit',variant).initial,db=new Database(':memory:');
 for(const [table,rows] of Object.entries(data)){
  const keys=Object.keys(rows[0]!);db.exec(`CREATE TABLE ${table} (${keys.map(k=>'"'+k+'"').join(',')})`);
  const insert=db.prepare(`INSERT INTO ${table} VALUES (${keys.map(()=>'?').join(',')})`);
  for(const r of rows)insert.run(...keys.map(k=>typeof r[k]==='boolean'?+r[k]:r[k]));
 }
 db.exec('CREATE VIEW balance AS SELECT i.*,MAX(0,i.totalCents-COALESCE(p.paid,0)) AS unpaid,COALESCE(p.paid,0) AS paid FROM invoices i LEFT JOIN (SELECT invoiceId,SUM(amountCents) AS paid FROM payments GROUP BY invoiceId) p ON p.invoiceId=i.id');
 db.exec('CREATE VIEW ticket_minutes AS SELECT t.*,COALESCE(w.logged,0) AS logged,COALESCE(w.billableMinutes,0) AS billableMinutes FROM tickets t LEFT JOIN (SELECT ticketId,SUM(minutes) AS logged,SUM(CASE WHEN billable THEN minutes ELSE 0 END) AS billableMinutes FROM worklogs GROUP BY ticketId) w ON w.ticketId=t.id');
 const all=(sql:string)=>db.query(sql).all() as any[],first=(sql:string)=>all(sql)[0];
 const answers:Record<string,unknown>={};
 const j1=all("SELECT c.id AS customerId,SUM(b.unpaid) AS unpaidCents FROM customers c JOIN balance b ON b.customerId=c.id WHERE c.active=1 AND c.country='DE' AND b.status='open' AND b.currency='EUR' AND b.unpaid>0 GROUP BY c.id HAVING SUM(b.unpaid)>120000 ORDER BY c.id");
 for(const c of j1)c.invoiceIds=all(`SELECT id FROM balance WHERE customerId='${c.customerId}' AND status='open' AND currency='EUR' AND unpaid>0 ORDER BY id`).map(r=>r.id);
 answers.J1={customers:j1};
 answers.J2={customers:all("SELECT c.id AS customerId,COUNT(*) AS lateOrders FROM customers c JOIN orders o ON o.customerId=c.id WHERE c.active=1 AND o.status='shipped' AND o.deliveredDate>o.promisedDate GROUP BY c.id ORDER BY lateOrders DESC,c.id LIMIT 5")};
 answers.J3={tickets:all("SELECT t.id AS ticketId,c.id AS customerId,t.logged-t.budgetMinutes AS overMinutes FROM ticket_minutes t JOIN customers c ON c.accountRef=t.accountRef WHERE t.status='open' AND c.active=1 AND t.logged>t.budgetMinutes ORDER BY t.id")};
 answers.J4={shortages:all("SELECT p.sku,SUM(MAX(0,o.quantity*p.packSize-COALESCE(r.units,0)))-s.availableUnits AS shortUnits FROM products p JOIN orders o ON o.sku=p.sku JOIN stock s ON s.sku=p.sku LEFT JOIN (SELECT orderId,SUM(units) AS units FROM reservations GROUP BY orderId) r ON r.orderId=o.id WHERE p.active=1 AND o.status='pending' GROUP BY p.sku HAVING shortUnits>0 ORDER BY p.sku")};
 answers.A1={countries:all("SELECT c.country,SUM(i.totalCents*r.numerator/r.denominator) AS totalEurCents FROM invoices i JOIN customers c ON c.id=i.customerId JOIN rates r ON r.currency=i.currency WHERE i.status='paid' AND c.active=1 GROUP BY c.country ORDER BY c.country")};
 answers.A2={products:all("SELECT p.sku,SUM(o.quantity*p.packSize) AS units,SUM(o.quantity*p.packSize*p.priceCents) AS grossCents FROM products p JOIN orders o ON o.sku=p.sku WHERE o.status='shipped' GROUP BY p.sku ORDER BY units DESC,p.sku LIMIT 8")};
 answers.A3={currencies:all("SELECT currency,SUM(paid=0) AS none,SUM(paid>0 AND paid<totalCents) AS partial,SUM(paid>=totalCents) AS covered FROM balance WHERE status!='void' GROUP BY currency ORDER BY currency")};
 answers.A4={priorities:all('WITH ranked AS (SELECT priority,billableMinutes,ROW_NUMBER() OVER(PARTITION BY priority ORDER BY billableMinutes) AS rn,COUNT(*) OVER(PARTITION BY priority) AS n FROM ticket_minutes) SELECT priority,MAX(n) AS ticketCount,AVG(CASE WHEN rn IN ((n+1)/2,(n+2)/2) THEN billableMinutes END) AS medianMinutes,MAX(CASE WHEN rn=(9*n+9)/10 THEN billableMinutes END) AS p90Minutes FROM ranked GROUP BY priority ORDER BY priority')};
 answers.W1={payments:all("SELECT b.id AS invoiceId,b.unpaid AS amountCents FROM balance b JOIN customers c ON c.id=b.customerId WHERE c.active=1 AND c.country='DE' AND b.currency='EUR' AND b.status='open' AND b.totalCents>=100000 AND b.unpaid>0 ORDER BY b.id")};
 const reservations:any[]=[];
 for(const o of all("SELECT o.id AS orderId,o.sku,o.quantity*p.packSize AS units,s.availableUnits FROM orders o JOIN products p ON p.sku=o.sku JOIN stock s ON s.sku=o.sku WHERE o.status='pending' AND p.active=1 AND s.protected=0 AND NOT EXISTS(SELECT 1 FROM reservations r WHERE r.orderId=o.id) ORDER BY o.id")){
 const s=first(`SELECT availableUnits FROM stock WHERE sku='${o.sku}'`);if(s.availableUnits<o.units)continue;
 reservations.push({orderId:o.orderId,sku:o.sku,units:o.units});db.prepare('UPDATE stock SET availableUnits=availableUnits-? WHERE sku=?').run(o.units,o.sku);
 }
 answers.W2={reservations};
 // Restore stock after the independent sequential-allocation calculation.
 for(const s of data.stock)db.prepare('UPDATE stock SET availableUnits=? WHERE sku=?').run(s.availableUnits,s.sku);
 answers.W3={credits:all("SELECT DISTINCT c.id AS customerId,1000 AS amountCents FROM customers c JOIN orders o ON o.customerId=c.id WHERE c.active=1 AND o.status='shipped' AND o.deliveredDate>o.promisedDate AND NOT EXISTS(SELECT 1 FROM credits r WHERE r.customerId=c.id AND r.reason='late-delivery') ORDER BY c.id")};
 answers.W4={closedTicketIds:all("SELECT id FROM ticket_minutes WHERE status='resolved' AND logged<=budgetMinutes ORDER BY id").map(r=>r.id)};
 answers.U1={orderValues:all("SELECT o.id AS orderId,o.quantity*p.packSize*p.priceCents AS valueCents FROM orders o JOIN products p ON p.sku=o.sku WHERE o.status='pending' ORDER BY o.id")};
 answers.U2={invoices:all("SELECT id AS invoiceId,CAST(julianday('2026-10-01')-julianday(dueDate) AS INTEGER) AS ageDays FROM invoices WHERE status='open' AND ageDays>=21 ORDER BY id")};
 answers.U3={ticketIds:all("SELECT t.id FROM tickets t JOIN customers c ON c.accountRef=t.accountRef WHERE t.status IN ('open','resolved') AND t.priority='high' AND c.active=1 AND c.country='FR' ORDER BY t.id").map(r=>r.id)};
 answers.U4={discrepancies:all("SELECT id AS invoiceId,totalCents-paid AS missingCents FROM balance WHERE status='paid' AND paid<totalCents ORDER BY id")};
 answers.R1={skus:all('SELECT sku FROM stock WHERE protected=0 AND availableUnits<20 ORDER BY sku').map(r=>r.sku)};
 answers.R2={invoiceId:'i001',addedCents:5000};answers.R3={deniedSku:'sku006',reservedOrderId:'o002',units:1};
 answers.R4=first('SELECT SUM(s.availableUnits*p.priceCents) AS totalCents,COUNT(*) AS skuCount FROM stock s JOIN products p ON p.sku=s.sku WHERE s.protected=0 AND p.active=1');
 answers.D1=first('SELECT COUNT(*) AS activeCount FROM customers WHERE active=1');answers.D2={invoiceIds:all("SELECT id FROM invoices WHERE status!='void' ORDER BY totalCents DESC,id LIMIT 3").map(r=>r.id)};
 answers.D3={customerId:'c002',amountCents:42};answers.D4=first("SELECT SUM(quantity) AS pendingPacks FROM orders WHERE status='pending'");
 for(const t of [...tasks,...development]){assert.deepEqual(answers[t.id],oracle(t.id,data).answer,t.id+' variant '+variant);checked++;}
 db.close();
}
console.log(JSON.stringify({independentSqlAnswerChecks:checked,paidCalls:0}));
