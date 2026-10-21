import {describe,it,expect} from 'vitest';
import {starter,parseMoney} from './engine';
import {openScheme,buyPolicy,buyPosition,sellPosition,claim,extra,forecastScheme,yieldPaise,importBackup,report} from './extended';
describe('extended demo flows',()=>{
 it('opens a PPF practice account and debits the demo savings',()=>{const s=starter(),n=openScheme(s,'ppf',500000,15);expect(n.accounts.find(a=>a.id==='acc_sb_parent')!.balance_paise).toBe(1300000);expect(extra(n).schemes).toHaveLength(1);expect(n.transactions.at(-1)!.tax_tag).toBe('deduction_80c_candidate')});
 it('purchases a stock then sells one unit',()=>{let n=buyPosition(starter(),'stock','Demo IT Ltd',2,100000);expect(extra(n).positions[0].units).toBe(2);n=sellPosition(n,extra(n).positions[0].id,1,100000);expect(extra(n).positions[0].units).toBe(1);expect(n.transactions.length).toBe(2)});
 it('records insurance document requirements and approved claims',()=>{let n=buyPolicy(starter(),'health',10000000,10000);const id=extra(n).policies[0].id;n=claim(n,id,200000,false);expect(extra(n).claims[0].status).toBe('needs_document');n=claim(n,id,200000,true);expect(extra(n).claims[1].status).toBe('approved')});
 it('keeps projections deterministic and respects nonnegative paise',()=>{expect(yieldPaise(100000,0,5)).toBe(100000);expect(forecastScheme({id:'x',owner:'prof_parent',kind:'td',principalPaise:100000,opened:'2026-10-21',years:1},0)).toBe(100000)});
 it('rejects malformed backup',()=>{expect(()=>importBackup('{"app":"OTHER"}')).toThrow()});
 it('returns integer paise summaries',()=>{expect(Number.isSafeInteger(report(starter()).netWorth)).toBe(true);expect(parseMoney('1,000.50')).toBe(100050)});
});
