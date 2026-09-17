# Agent 开发流程

本规范适用于本仓库的开发任务。默认完成修改、验证、提交到 `dev`、推送并检查 CI；用户明确要求只在本地修改、不提交或不推送时，遵循用户要求。

## 分支与开始工作

- 日常开发分支是 `dev`，上游必须是 `origin/dev`。`main` 保持为 GitHub 默认分支和生产分支；不要在 `main` 或旧 `master` 上提交开发改动。
- 开始前检查 `git status --short --branch`、当前分支和已有修改，再 `git fetch origin` 确认远程状态。
- 本地已有 `dev` 时切换到它；没有时从 `origin/dev` 创建跟踪分支。工作区允许安全同步时使用 `git pull --ff-only`，不要通过 reset 或强制推送覆盖历史。
- 保留用户或其他任务的未提交修改。若切换、同步会影响这些修改，使用基于 `origin/dev` 的独立 worktree；不要擅自 stash、丢弃或提交无关工作。
- 多个任务可能共享工作区。暂存和提交前再次核对分支、HEAD、文件差异及暂存区，避免将其他任务刚写入的内容一并提交。

## 实现与验证

- 使用 Node.js 24；首次安装或依赖变更时使用 `npm ci`，保持 `package-lock.json` 与依赖同步。
- 应用代码变更在推送前运行 `npm test`，修复与本次改动相关的失败。UI 改动还应做适当的浏览器检查；自动化测试不能替代视觉验收。
- 纯文档修改检查内容和 `git diff --check` 即可，无需重复本地应用测试；推送后仍由 CI 执行完整测试。
- 不硬编码测试数量。当前测试范围以 `tests/` 为准，不把本地 JSON 存储测试描述为真实 Neon 或生产环境验证。
- `.env`、数据库凭据和本地 `data/` 不得进入提交。

## 提交与推送

- 只暂存本次任务的文件或改动块；使用明确路径，避免 `git add .` 将共享工作区的其他改动带入提交。
- 提交前检查 `git diff --cached` 和 `git diff --cached --check`，确认提交内容完整且不含无关修改。
- 在 `dev` 上提交，并使用 `git push origin dev`。首次推送可使用 `git push -u origin dev`；不要手动推送或合并到 `main`。
- 若推送因远程新增提交被拒绝，先 fetch，保留双方工作，在 `dev` 整合远程变更并重新验证，再正常推送。不得 force-push。

## 等待 CI 与自动合入

- 工作流为 `.github/workflows/ci.yml`。`Tests (Node 24)` 成功后，`Promote tested dev to main` 自动将通过测试的原始提交快进合入 `main`。
- 推送后记录提交 SHA，查找对应的 GitHub Actions 运行并等待结果；不要仅因 push 成功就宣布任务已合入。可使用 `gh run list --branch dev --commit <SHA>` 和 `gh run view <RUN_ID>` 检查。
- 测试失败时读取失败日志，修复后提交到 `dev` 再推送。合入任务失败时检查其日志，不能把测试成功当作合入成功。
- 若 `main` 已分叉，将 `origin/main` 合入 `dev`，解决冲突、验证并推送，让 CI 测试整合后的提交。不得关闭分支保护、绕过必需检查或强制更新 `main`。
- 新的 dev 提交可能取消旧运行，或使旧合入任务跳过。应跟踪包含本次提交的新运行，并 fetch 后确认本次 SHA 已被 `origin/main` 包含；不要仅凭工作流整体成功认定旧提交已合入。
- CI 成功后 fetch 并验证目标提交已进入 `origin/main`，本地继续保留在跟踪 `origin/dev` 的 `dev` 上。
- CI 超时、权限或外部服务故障导致无法完成时，明确报告已完成内容、阻塞原因和运行链接，不声称合入或部署成功。

## 部署与交付说明

- Render 应跟踪 `main`。通过 CI 和合入 main 不等于部署成功；只有实际检查部署状态后才能声称已上线。
- 当前自动合入使用 `GITHUB_TOKEN`，不会再触发 main 的 push 工作流。新增 GitHub Actions 部署任务时，应衔接现有成功流程，不能依赖自动合入触发另一条 push 工作流。
- 交付时简要说明修改内容、验证结果、提交 SHA、CI 运行链接及合入状态；有保留的无关本地修改时注明，不将工作区描述为干净。
- 流程背景和部署配置见 `README.md` 的“开发与持续集成”及“Render + Neon”部分。
