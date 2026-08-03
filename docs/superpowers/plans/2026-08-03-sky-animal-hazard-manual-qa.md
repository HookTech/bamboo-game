# Sky Animal Hazard — Manual QA

Worktree / branch: `feature/sky-animal-hazard`

Open Cocos Creator 3.8.8 → `cocos/` → preview `assets/main.scene`.

- [ ] coins < 20: no animals
- [ ] coins ≥ 20: within ~8–12s fade-in dive (colored capsules)
- [ ] animal on right + tap right side with strong bend → knock arc + knock SFX
- [ ] let animal hit → stun shake/stars + coins decrease + drop FX/SFX; score unchanged
- [ ] during stun: animals freeze, no new spawns
- [ ] coins ≥ 100: up to 2 animals concurrent

Automated: `cd cocos && npm test` (expect all green).
