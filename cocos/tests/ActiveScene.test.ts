import { resolveScenePack } from '../assets/scripts/app/ActiveScene';
import { getPack } from '../assets/scripts/content/registry';

describe('ActiveScene', () => {
  it('resolves default', () => {
    expect(resolveScenePack('default').id).toBe('default');
  });

  it('falls back to default on unknown id', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const p = resolveScenePack('nope' as 'default');
    expect(p.id).toBe('default');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('registry has work and cny', () => {
    expect(getPack('work')?.id).toBe('work');
    expect(getPack('cny')?.id).toBe('cny');
  });
});
