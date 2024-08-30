# OI Wiki Feedback System

OI Wiki Feedback System 提供了一套完整的前后端系统，可以为网站提供段落级别的划词评论功能，该系统目前已经部署至 OI Wiki 主站。

## 项目架构

- [/python-markdown-extension](/python-markdown-extension/) Python Markdown 编译器插件，解析源文档 Markdown 段落和编译后 HTML 元素的对应关系，并将关系存储在后者中。
- [/cloudflare-workers](/cloudflare-workers) 基于 CloudFlare Workers 的后端服务，提供数据存取和 OAuth 认证服务。
- [/frontend](/frontend/) 前端服务，注入组件到页面并与后端进行数据交互。

## 编译

要编译 OI Wiki Feedback System，请先从 GitHub clone 仓库到本地并切换到项目目录：

```shell
git clone https://github.com/OI-wiki/feedback-sys.git && cd feedback-sys
```

### 编译 python-markdown-extension

要编译 python-markdown-extension，你需要先[安装 rye](https://rye.astral.sh/guide/installation/)，然后运行：

```shell
cd python-markdown-extension && rye sync && rye build
```

编译构件位于 `dist/` 目录

### 编译 frontend

要编译 frontend，你需要先[安装 yarn](https://yarnpkg.com/getting-started/install)，然后运行：

```shell
cd frontend && yarn && yarn build
```

编译构件位于 `dist/` 目录

## 部署

要将 OI Wiki Feedback System 部署到你的网站上，你需要：

- 正在使用 python-markdown 作为你的 Markdown 编译器
- 可以使用 Cloudflare Workers 作为后端服务

随后，进行如下操作来部署 OI Wiki Feedback System：

### 部署 python-markdown-extension

使用你喜欢的包管理器在项目中引入 `python-markdown-document-offsets-injection-extension` 包。例如对于 pip，请执行：

```shell
pip3 install python-markdown-document-offsets-injection-extension
```

然后，为你的 Python Markdown 编译流程引入此插件：

```python
import markdown

markdown.markdown(content,
    extensions=["document-offsets-injection"],
    # 启用 debug 模式
    # extension_configs={
    #  "document-offsets-injection": {
    #      "debug": True,
    #  }
    # }
)
```

如果你正在使用 mkdocs，则需要从 mkdocs.yml 中引入插件：

```yaml
markdown_extensions:
  - document-offsets-injection:
      # 启用 debug 模式
      # debug: true
```

### 部署 cloudflare-workers

要部署 cloudflare-workers，请先创建一个 Cloudflare D1 实例，前往 [wrangler.toml](cloudflare-workers/wrangler.toml)，将 `d1_databases` 中的 `database_name` 和 `database_id` 修改为你自己的：

```toml
[[d1_databases]]
binding = "DB"
database_name = "comments" # 修改这里
database_id = "eba686c4-352d-4a8d-8f4e-fb3801166973" # 和这里
```

然后，前往 [index.ts](cloudflare-workers/src/index.ts) 修改 CORS allow-origin 信息为您的前端地址。

随后，运行 `(yarn) wrangler d1 execute comments --file=schema.sql` 以初始化数据表。

完成后，运行 `(yarn) wrangler deploy` 并依照提示以部署 workers 到你的账户上。

接下来，请先预先准备以下数据：
1. `ADMINISTRATOR_SECRET`: 一段任意的字符串，用于验证管理员身份
2. `TELEGRAM_BOT_TOKEN`：Telegram Bot Token，用于在有人评论时自动发送通知
3. `TELEGRAM_CHAT_ID`：需要发送到的 Telegram 聊天/群组的 ID，可以以逗号分隔来添加多个
4. `GITHUB_APP_CLIENT_ID`：GitHub App Client ID，用于 GitHub 登录（创建 GitHub App 时请务必勾选 Request User Authorization (OAuth) during installation，其余选项可以保持默认）
5. `GITHUB_APP_CLIENT_SECRET`：GitHub App Client Secret，用处同上
6. `OAUTH_JWT_SECRET`：一段任意的字符串，作为密钥，用于签发 JWT

完成后，依次为上述数据运行下述指令，并依照提示传入准备好的数据：

```shell
wrangler secret put <KEY>
```

即可完成项目的基本部署。

如果您需要自动化部署，可参考我们的 GitHub Actions：[Deploy cloudflare-workers to Workers](.github/workflows/deploy-cloudflare-workers.yml)。

接下来，请参考 OI Wiki 已有的实践，来帮助 cloudflare-workers 可以正确更新变更的数据：

- [update-feedback-sys-meta.yml](https://github.com/OI-wiki/OI-wiki/blob/master/.github/workflows/update-feedback-sys-meta.yml) - GitHub Actions Workflow，用于检测文件变更并将变更的文件信息传递给下述文件
- [update-feedback-sys-meta.py](https://github.com/OI-wiki/OI-wiki/blob/master/scripts/update-feedback-sys-meta.py) - 用于收取变更文件信息、计算更改并将更改传递给 cloudflare-worker

## 部署 frontend

使用你喜欢的包管理器在项目中引入 `oiwiki-feedback-sys-frontend` 包。例如对于 yarn，请执行：

```shell
yarn add oiwiki-feedback-sys-frontend
```

当然，您也可直接在页面上引入：

```html
<!-- 对于 ES Module -->
 <script type="text/javascript" src="https://unpkg.com/oiwiki-feedback-sys-frontend@0.3.1/dist/oiwiki-feedback-sys-frontend.js"></script>

<!-- 对于 UMD 和直接引入 -->
<script type="text/javascript" src="https://unpkg.com/oiwiki-feedback-sys-frontend@latest/dist/oiwiki-feedback-sys-frontend.umd.cjs"></script>
```

如果您使用 ES Module，请通过如下方式引入我们的 setup 函数：

```javascript
import { setupReview } from 'oiwiki-feedback-sys-frontend'
```

如果是 UMD，则这样做：

```javascript
let setupReview = require('oiwiki-feedback-sys-frontend').setupReview;
```

如果您直接引入浏览器环境而没有使用任何模块系统，则可以直接从全局变量引入：

```javascript
var setupReview = OIWikiFeedbackSysFrontend.setupReview
```

引入后，请调用 `setupReview` 函数：

```javascript
setupReview(
    element,  /* 您需要注入评论系统的 HTML Element */
    { apiEndpoint: '您的 cloudflare workers 服务地址' }
)
```

最后，别忘了引入我们的 style 文件：

```html
<!-- 从 HTML 引入 -->
<link rel="stylesheet" type="text/css" href="https://unpkg.com/oiwiki-feedback-sys-frontend@latest/dist/style.css">
```

```javascript
// 从 JS 引入（如果构建工具支持）
import 'oiwiki-feedback-sys-frontend/style.css'
```

Enjoy!

## 开发和测试

### python-markdown-extension

要进行开发环境调试，可运行 `python ./test/cli.py`，其提供了一个 cli 环境以将一个包含 markdown 的文件进行编译并输出结果。

要进行单元测试，请运行 `rye run test`。

### cloudflare-workers

要进行开发环境调试，请运行 `yarn dev`。

要进行单元测试，请运行 `yarn test`。

### frontend

要进行开发环境调试，请运行 `yarn dev`。

## License

OI Wiki Feedback System is licensed under the [Apache-2.0 license](LICENSE).