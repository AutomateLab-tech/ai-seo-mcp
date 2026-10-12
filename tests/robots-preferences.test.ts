import {describe,it,expect,vi} from 'vitest';
vi.mock('../src/lib/robots.js',async importOriginal=>{
  const original=await importOriginal<typeof import('../src/lib/robots.js')>();
  return {...original,fetchRobotsTxt:vi.fn()};
});
import {fetchRobotsTxt} from '../src/lib/robots.js';
import {checkRobots} from '../src/tools/check-robots.js';
async function inspect(text:string){vi.mocked(fetchRobotsTxt).mockResolvedValue(text);return checkRobots({domain:'fixture.example'});}
const penalties=(row:Awaited<ReturnType<typeof checkRobots>>)=>row.findings.filter(f=>f.severity==='warning'||f.severity==='critical');
describe('training and search preferences',()=>{
  it('does not penalize training-only changes',async()=>{
    const allowed=await inspect('User-agent: *\nAllow: /');
    const optedOut=await inspect('User-agent: *\nAllow: /\nUser-agent: GPTBot\nDisallow: /\nUser-agent: ClaudeBot\nDisallow: /\nUser-agent: Google-Extended\nDisallow: /');
    expect(penalties(optedOut)).toEqual(penalties(allowed));
    expect(optedOut.search_crawlers).toEqual(allowed.search_crawlers);
  });
  it.each(['Googlebot','PerplexityBot'])('reports an actual %s search restriction',async agent=>{
    const row=await inspect('User-agent: *\nAllow: /\nUser-agent: '+agent+'\nDisallow: /');
    expect(row.search_crawlers[agent]).toBe('disallowed');
    expect(penalties(row).some(f=>f.where.includes(agent))).toBe(true);
  });
});
