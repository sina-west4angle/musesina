# musesina · 飞书智能体

在飞书里 @机器人或私聊发指令 → Supabase Edge Function 云端执行 → 数据留 Supabase → 结果回飞书。

## 结构

```
supabase/functions/musesina-feishu-webhook/  # 飞书消息 webhook（消息分流）
.github/workflows/deploy.yml                # push-sentinel 自动部署
.deploy-sentinel                             # 哨兵文件：改动并 push 即触发部署
```

## 部署

- 改代码或哨兵文件 → push → GitHub Actions 自动部署。
- 验收只认 Actions 日志里的 `Deployed Functions` 成功行。
- 避坑：不用 supabase-cli 直连（401）；不用 `workflow_dispatch`（403）；workflow yml 只在网页 UI 改。

## 凭证（绝不进 git）

- `SUPABASE_ACCESS_TOKEN`（`sbp_` 开头）：GitHub 仓库 secret，给 Actions 用。
- service_role key：Supabase Edge Function 环境变量。
- 数据库密码：平时不用。

## 命名

表前缀 `musesina_`，环境变量前缀 `MUSESINA_`，写入动作 `musesina_db_write`（白名单表）。
