# py.kg NIC - 子域名注册局

基于 Cloudflare Pages + D1 + deSEC 的子域名注册与 DNS 托管平台。

## 目录结构

```
pykg-nic/
├── public/
│   └── index.html              # 前端页面
├── functions/
│   ├── lib/
│   │   ├── types.ts            # 类型定义
│   │   ├── jwt.ts              # JWT 签名/验签 (WebCrypto)
│   │   ├── auth.ts             # 认证中间件
│   │   ├── validators.ts       # 域名/记录校验
│   │   └── desec.ts            # deSEC API 客户端
│   ├── auth/
│   │   ├── login.ts            # OAuth2 登录入口
│   │   ├── callback.ts         # OAuth2 回调处理
│   │   └── logout.ts           # 登出
│   └── api/
│       ├── me.ts               # 用户信息 API
│       ├── domains.ts          # 域名注册/管理 API
│       └── rrsets.ts           # DNS 记录管理 API
├── schema.sql                  # D1 数据库 Schema
├── wrangler.jsonc              # Wrangler 配置
├── package.json
└── README.md
```

## 前置要求

1. Cloudflare 账号
2. LinuxDO Connect OAuth2 应用（需要 client_id 和 client_secret）
3. deSEC 账号及 API Token
4. py.kg 域名已托管在 deSEC

## 部署步骤

### 1. 创建 D1 数据库

```bash
# 创建数据库
wrangler d1 create pykg-nic-db

# 记录返回的 database_id，更新到 wrangler.jsonc
```

### 2. 初始化数据库 Schema

```bash
# 本地开发环境
wrangler d1 execute pykg-nic-db --local --file=./schema.sql

# 生产环境
wrangler d1 execute pykg-nic-db --remote --file=./schema.sql
```

### 3. 配置环境变量

在 Cloudflare Dashboard 中配置 Pages 项目的环境变量（Settings > Environment variables）：

**必需的 Secrets（加密存储）：**

| 变量名 | 说明 |
|--------|------|
| `LINUXDO_CLIENT_ID` | LinuxDO Connect OAuth2 Client ID |
| `LINUXDO_CLIENT_SECRET` | LinuxDO Connect OAuth2 Client Secret |
| `JWT_SIGNING_KEY` | JWT 签名密钥（建议 32+ 字符随机字符串） |
| `DESEC_TOKEN` | deSEC API Token |

**可选的环境变量：**

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `BASE_DOMAIN` | `py.kg` | 基础域名 |
| `SESSION_COOKIE_NAME` | `session` | Session Cookie 名称 |

生成 JWT 签名密钥：
```bash
openssl rand -base64 32
```

### 4. 部署到 Cloudflare Pages

```bash
# 安装依赖
npm install

# 本地开发
npm run dev
# 或
wrangler pages dev ./public --d1=DB=pykg-nic-db

# 部���到生产
npm run deploy
# 或
wrangler pages deploy ./public
```

### 5. 绑定自定义域名

1. 在 Cloudflare Pages 项目设置中添加自定义域名：`nic.py.kg`
2. 在 deSEC 中为 py.kg 添加 CNAME 记录：
   ```
   nic.py.kg -> pykg-nic.pages.dev
   ```
   或者如果 Cloudflare 提供了特定的 CNAME 目标，使用该目标。

### 6. 配置 LinuxDO OAuth2 回调地址

在 LinuxDO Connect 应用设置中，配置回调地址：
- 生产环境：`https://nic.py.kg/auth/callback`
- 测试环境：`https://pykg-nic.pages.dev/auth/callback`

如果 LinuxDO 只允许一个回调地址，测试时需要临时修��。

## 本地开发

```bash
# 安装依赖
npm install

# 启动本地开发服务器（带 D1 本地模拟）
wrangler pages dev ./public --d1=DB=pykg-nic-db

# 访问 http://localhost:8788
```

注意：本地开发时 OAuth2 回调会失败（除非配置了本地回调地址）。可以：
1. 使用 `wrangler pages dev` 的 `--remote` 模式连接远程 D1
2. 或者先部署到 pages.dev 域名进行测试

## 手动测试步骤

### 阶段 1：使用 pages.dev 域名测试

1. 部署到 Cloudflare Pages，获得 `pykg-nic.pages.dev` 域名
2. 在 LinuxDO Connect 中将回调地址设为 `https://pykg-nic.pages.dev/auth/callback`
3. 访问 `https://pykg-nic.pages.dev`
4. 点击"使用 LinuxDO 登录"
5. 授权后应该跳转回首页并显示用户信息
6. 尝试注册一个测试域名（如 `test123`）
7. 添加一条 A 记录测试 DNS 管理

### 阶段 2：切换到正式域名

1. 在 deSEC 添加 CNAME 记录：`nic -> pykg-nic.pages.dev`
2. 在 Cloudflare Pages 添加自定义域名 `nic.py.kg`
3. 在 LinuxDO Connect 中将回调地址改为 `https://nic.py.kg/auth/callback`
4. 访问 `https://nic.py.kg` 进行完整测试

## API 文档

### 认证

所有 `/api/*` 端点需要有效的 JWT Session Cookie。

### GET /api/me

获取当前用户信息和配额。

**响应：**
```json
{
  "success": true,
  "data": {
    "user": {
      "linuxdo_id": 12345,
      "username": "example",
      "trust_level": 2
    },
    "quota": {
      "maxDomains": 1,
      "used": 0
    }
  }
}
```

### GET /api/domains

获取当前用户的域名。

**响应：**
```json
{
  "success": true,
  "data": {
    "domain": {
      "label": "example",
      "fqdn": "example.py.kg",
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

### POST /api/domains

注册新域名。

**请求：**
```json
{
  "label": "example"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "domain": {
      "label": "example",
      "fqdn": "example.py.kg",
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

### DELETE /api/domains

删除当前用户的域名。

### GET /api/rrsets

获取域名的 DNS 记录。

**响应：**
```json
{
  "success": true,
  "data": {
    "domain": "example.py.kg",
    "rrsets": [
      {
        "subname": "",
        "type": "A",
        "ttl": 3600,
        "records": ["1.2.3.4"]
      }
    ]
  }
}
```

### PUT /api/rrsets

批量更新 DNS 记录（幂等，会删除不在列表中的记录）。

**请求：**
```json
{
  "rrsets": [
    {
      "subname": "",
      "type": "A",
      "ttl": 3600,
      "records": ["1.2.3.4"]
    },
    {
      "subname": "www",
      "type": "CNAME",
      "ttl": 3600,
      "records": ["example.py.kg."]
    }
  ]
}
```

### PATCH /api/rrsets

更新单条 DNS 记录。

**请求：**
```json
{
  "subname": "",
  "type": "A",
  "ttl": 3600,
  "records": ["1.2.3.4", "5.6.7.8"]
}
```

### DELETE /api/rrsets?subname=&type=A

删除指定的 DNS 记录。

## 安全注意事项

### 已实现的安全措施

1. **OAuth2 State 校验**：防止 CSRF 攻击，state 存储在 HttpOnly Cookie 中
2. **PKCE 支持**：增强 OAuth2 授权码流程安全性
3. **HttpOnly Cookie**：Session Token 存储在 HttpOnly Cookie 中，防止 XSS 窃取
4. **SameSite=Lax**：防止 CSRF 攻击
5. **JWT 验签与过期校验**：使用 HMAC-SHA256，检查 exp 声明
6. **Trust Level 校验**：仅允许 TL >= 2 的用户
7. **Silenced/Suspended 检查**：禁止被禁言或封禁的用户
8. **记录类型限制**：仅允许 A/AAAA/CNAME/TXT，禁止 MX
9. **CNAME 冲突检测**：CNAME 不能与其他类型共存
10. **私有 IP 过滤**：A 记录禁止私有/保留 IP 地址
11. **保留标签列表**：禁止注册敏感子域名
12. **审计日志**：记录关键操作

### 建议的额外安全措施

1. **Rate Limiting**：可以使用 Cloudflare 的 Rate Limiting 规则
2. **WAF 规则**：启用 Cloudflare WAF 防护
3. **监控告警**：监控异常注册行为

## 保留标签列表

以下标签不允许注册：

```
www, mail, smtp, imap, pop, pop3, ftp, ns, ns1, ns2, dns, mx,
localhost, local, test, example, invalid,
login, signin, signup, account, accounts, verify, verification,
secure, security, auth, authentication, password, reset,
billing, payment, pay, wallet,
admin, administrator, support, help, service, services,
official, system, status, root, owner, staff,
api, console, dashboard, manage, panel, docs, blog,
static, cdn, assets, home,
nic, whois, registry, registrar, abuse, postmaster, webmaster,
hostmaster, noc, info, contact, about, legal, terms, privacy,
ssl, tls, cert, certificate, autoconfig, autodiscover,
_dmarc, _domainkey, _acme-challenge
```

## 故障排除

### OAuth2 回调失败

1. 检查回调地址是否正确配置
2. 检查 LINUXDO_CLIENT_ID 和 LINUXDO_CLIENT_SECRET 是否正确
3. 查看 Cloudflare Pages 日志

### deSEC API 错误

1. 检查 DESEC_TOKEN 是否有效
2. 确认 py.kg 已在 deSEC 托管
3. 检查 deSEC API 配额限制

### D1 数据库错误

1. 确认 database_id 配置正确
2. 确认 Schema 已初始化
3. 检查 D1 绑定是否正确

## License

MIT
