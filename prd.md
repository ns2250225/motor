# 《鹈鹕暴力摩托》3D 网页游戏 PRD 产品需求文档

版本：V1.0 ｜ 游戏类型：3D 竞速 / 搞怪战斗 / 休闲竞技 ｜ 平台：PC 浏览器 + 移动端浏览器

## 一、项目概述

### 1.1 游戏简介

《鹈鹕暴力摩托》（Pelican Road Rage）是一款以搞怪鹈鹕为主角的 3D 摩托车竞速战斗网页游戏。

玩家驾驶各种造型夸张的摩托车，与其他鹈鹕骑手在不同赛道上展开激烈竞速。除了正常驾驶、漂移和加速，玩家还可以利用鹈鹕标志性的大嘴巴、翅膀以及各种搞怪道具攻击对手，将对手撞飞、啄翻或者甩出赛道。

游戏整体采用卡通低多边形（Low Poly）3D 美术风格，强调夸张的物理反馈、搞笑的角色动作、爽快的战斗以及简单易上手的操作。

游戏支持 PC 和移动端浏览器，移动端采用横屏布局，并在设备与浏览器允许的情况下自动请求横屏。

[鹈鹕骑单车 · Pelican on a Bike](https://images.openai.com/static-rsc-4/89SQ8LZscqI1vbE7fr3sqSIgl3Y2HF3Eat03yvCyHv-AXYPL2vmkjT6AJRrppKn2wHTXw6ZKGj_nfCrMyYbgEueWqqwDmS-hUie_LYnJBpQbgG23FosvPQQnYdGZBzoc6RTTuGdXxbUnhG1nuj3f3mlk-vkxKxUS5XlNQ2DXApY?purpose=inline)

[Cafe Racer | Play Free Online on MadKidGames](https://images.openai.com/static-rsc-4/zR0UNu4VlE5jWwf26kygdAYVEPZqe1TeTt7F-7ona3oCnOR3NfE1YVIhKIu2RjDOL91gLuT1kwuqv1yUszODpvoJA4gcshvUHULGbhRkDyC8rVJeX9HXF7ay69e_J4vtJxBDiwxg9x5jliiRczh8UAamqIay5ZjJdQqHFLwZcAA?purpose=inline)

[Nitro Circuit Clash - 3D Racing by Jabali AI](https://images.openai.com/static-rsc-4/vEFdE55fjHrFACb0yknM-qluvlOxXdn-5fXa63YWJzwy2_ridhEWCEMVi6eKR2B_HGkI6DULxTzsS1gj5c5fJF-jBVEcUeqJDLZxsVV5wawRv8tf4q3yD32rbJyyv3EXaQE7C1ItNNbg0spkb_89jk7clbVOzhq1_DQplJUNMvU?purpose=inline)

10

美术方向参考：卡通鹈鹕角色、夸张摩托造型与明亮的 3D 竞速场景。

### 1.2 核心卖点

- 鹈鹕大嘴战斗：用嘴巴啄击、夹住对手、甩出道具。
- 3D 暴力竞速：高速驾驶、漂移、冲撞、踢击和搞怪战斗。
- 多条主题赛道：海滨、城市、沙漠、雪山、火山等不同环境。
- 夸张物理效果：对手被撞飞、摩托翻滚、鹈鹕羽毛乱飞。
- 丰富的摩托与角色：解锁不同造型的鹈鹕、摩托和装饰。
- PC + 手机双端游玩：根据设备自动适配操作方式。
- 无需下载安装：打开网页即可开始游戏。

### 1.3 技术目标

| 项目    | 目标                        |
| ----- | ------------------------- |
| 游戏类型  | 单人 3D 竞速战斗                |
| 运行平台  | Chrome、Edge、Safari 等现代浏览器 |
| PC 画面 | 16:9 优先，自适应窗口             |
| 手机画面  | 横屏 16:9 至 21:9 自适应        |
| 渲染引擎  | Three.js                  |
| 开发语言  | TypeScript                |
| 前端框架  | Vue 3 + Vite              |
| 物理引擎  | Rapier 3D                 |
| 数据存储  | IndexedDB / localStorage  |
| 后端    | MVP 不需要                   |
| 目标帧率  | PC 60 FPS、移动端 30–60 FPS   |

## 二、游戏核心玩法

### 2.1 游戏流程

\#chatgpt-mermaid-\_r_au\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_au\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_au\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_au\_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-\_r_au\_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_au\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_au\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_au\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_au\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_au\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_au\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_au\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_au\_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_au\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_au\_ p{margin:0;}#chatgpt-mermaid-\_r_au\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_au\_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_au\_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_au\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_au\_ .label text,#chatgpt-mermaid-\_r_au\_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_au\_ .node rect,#chatgpt-mermaid-\_r_au\_ .node circle,#chatgpt-mermaid-\_r_au\_ .node ellipse,#chatgpt-mermaid-\_r_au\_ .node polygon,#chatgpt-mermaid-\_r_au\_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-\_r_au\_ .rough-node .label text,#chatgpt-mermaid-\_r_au\_ .node .label text,#chatgpt-mermaid-\_r_au\_ .image-shape .label,#chatgpt-mermaid-\_r_au\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_au\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_au\_ .rough-node .label,#chatgpt-mermaid-\_r_au\_ .node .label,#chatgpt-mermaid-\_r_au\_ .image-shape .label,#chatgpt-mermaid-\_r_au\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_au\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_au\_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_au\_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_au\_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-\_r_au\_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-\_r_au\_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_au\_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_au\_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_au\_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-\_r_au\_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_au\_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_au\_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_au\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_au\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_au\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_au\_ .icon-shape,#chatgpt-mermaid-\_r_au\_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_au\_ .icon-shape p,#chatgpt-mermaid-\_r_au\_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-\_r_au\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_au\_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_au\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_au\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_au\_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-\_r_au\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_au\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_au\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_au\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_au\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_au\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_au\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_au\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_au\_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-\_r_au\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_au\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_au\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_au\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_au\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_au\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_au\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_au\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_au\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_au\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_au\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_au\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-\_r_au\_ .node rect,#chatgpt-mermaid-\_r_au\_ .node circle,#chatgpt-mermaid-\_r_au\_ .node ellipse,#chatgpt-mermaid-\_r_au\_ .node polygon,#chatgpt-mermaid-\_r_au\_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_au\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_au\_ .node.mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_au\_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_au\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_au\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}进入游戏主菜单选择游戏模式选择赛道选择鹈鹕和摩托加载3D赛道倒计时开始竞速与战斗比赛结束?排名与奖励结算金币与解锁内容否是

### 2.2 核心竞速机制

玩家与 7 名 AI 鹈鹕骑手同时出发，在赛道上争夺排名。

- 默认 8 名骑手参赛。
- 每场比赛 2–3 圈，可按赛道设置。
- 玩家可以超车、漂移、加速、攻击其他骑手。
- 赛道包含弯道、跳台、障碍物、加速带和隐藏捷径。
- 根据最终排名、战斗表现和特殊挑战给予奖励。
- 玩家摔车后经过短暂恢复即可重新加入比赛。

### 2.3 摩托驾驶系统

| 操作   | 效果          |
| ---- | ----------- |
| 加速   | 提升摩托速度      |
| 刹车   | 降低速度        |
| 左右转向 | 控制方向        |
| 漂移   | 快速过弯，积累氮气   |
| 氮气加速 | 短时间高速冲刺     |
| 跳跃特技 | 在跳台上完成空中特技  |
| 碰撞   | 与其他摩托产生物理交互 |

驾驶手感采用街机风格，不追求真实摩托模拟。

设计要求：

- 摩托转弯时车身明显倾斜。
- 高速驾驶产生速度线和动态镜头。
- 漂移时轮胎产生烟雾和摩擦火花。
- 经过坡道可以短暂腾空。
- 落地时产生镜头震动。
- 撞击障碍物时根据速度产生不同程度的失控。

## 三、鹈鹕战斗系统

这是游戏区别于普通摩托竞速的核心特色。

### 3.1 基础战斗

| 攻击方式   | 描述         | 冷却    |
| ------ | ---------- | ----- |
| 左翅拍击   | 攻击左侧对手     | 1.5 秒 |
| 右翅拍击   | 攻击右侧对手     | 1.5 秒 |
| 大嘴啄击   | 向前啄击目标     | 2 秒   |
| 大嘴横扫   | 横向甩动大嘴攻击   | 4 秒   |
| 摩托冲撞   | 高速撞击其他摩托   | 无独立冷却 |
| 嘴巴夹击   | 夹住附近骑手并甩开  | 8 秒   |
| 超级鹈鹕冲刺 | 张开大嘴高速向前冲击 | 消耗能量  |

攻击会根据玩家与目标的距离、方向和相对速度判定命中。

### 3.2 大嘴特色机制

鹈鹕拥有巨大的嘴巴和喉囊，可以实现普通摩托游戏没有的战斗玩法。

大嘴夹击：

1. 靠近敌方摩托。
2. 发动夹击技能。
3. 鹈鹕伸长脖子并张开大嘴。
4. 命中后夹住敌人或其摩托的一部分。
5. 短暂蓄力后将对手甩出去。
6. 敌人失控，触发搞怪翻滚动画。

大嘴储物：

玩家可以利用鹈鹕的喉囊储存一个拾取道具，嘴巴鼓起形成明显的视觉提示。

大嘴喷射：

鹈鹕可以将喉囊中的鱼、贝壳、水球等道具向前喷射，击中对手。

### 3.3 战斗道具

| 道具    | 效果               |
| ----- | ---------------- |
| 臭鱼炸弹  | 爆炸产生臭气，使附近骑手短暂打滑 |
| 冰冻鱼   | 让目标短暂减速          |
| 超级沙丁鱼 | 恢复氮气能量           |
| 羽毛风暴  | 干扰附近对手的视线        |
| 弹力河豚  | 命中目标后将其弹飞        |
| 香蕉鱼皮  | 在路面留下打滑陷阱        |
| 黄金鲤鱼  | 短时间获得无敌效果        |
| 火箭鱼   | 发射追踪飞鱼攻击前方对手     |
| 墨鱼烟雾  | 在身后释放墨汁烟雾        |
| 巨型鱼骨  | 作为近战武器横扫敌人       |

### 3.4 夸张物理反馈

被攻击时，角色可以出现以下效果：

- 鹈鹕脖子像弹簧一样晃动。
- 大嘴因撞击产生夸张变形。
- 羽毛四处飞散。
- 摩托旋转、滑行、翻滚。
- 骑手从摩托上弹起。
- 落地时出现卡通星星和眩晕特效。
- 角色摔倒后快速爬起，重新骑上摩托。

物理系统采用真实碰撞 + 程序化动画 + 预设夸张动作的混合方式，避免完全依赖布娃娃物理造成不可控的驾驶体验。

## 四、赛道系统

游戏首个完整版本规划 10 条不同主题的 3D 赛道，每条赛道都有独立的环境、障碍物、捷径和视觉特色。

01\. 鹈鹕海岸公路

新手赛道

海滨公路、沙滩、棕榈树、海鸥群。宽阔直道搭配缓弯，适合熟悉驾驶和战斗。可穿过海边木栈道作为捷径。

[Cyber Cycle by Royal Potato Studio](https://images.openai.com/static-rsc-4/byg0Ycf_bDknPQde7x2hB7JYE6CTBl0yRa9msT12M7MfcCC3wll4EWddL8z1ZlMYex2QD70_3IJ9SXnzX_ReUcJzSRgpI4kau8tDOyWboApckoSN5uZcIr3HTPhjTdSbewDkaVS6R8DZUERwRU38CX52eRbgKZWs9y66818agpo?purpose=inline)

02\. 霓虹都市

夜间城市、霓虹广告、立交桥和隧道。道路狭窄，交通障碍较多，可以利用坡道飞越车辆。

[\[Update\] Faily Rider hopefully won't fail hard as it hits iOS, out now | Pocket Gamer](https://images.openai.com/static-rsc-4/EracY5xqNM-eP0_foNV68NEpe94UHOHoGgkFwTWhunTZNBkmC6_MycQxuSTLYVtdK8RANULZj_tKcS1SZ2_NnpaJOYjqsqKP1LKLQn7zuKKNZ3iMylZ5MU0nghDNHBoS7uktqtTVbwE053wBIypeKA0UsaH4Cxn_TzjA5N66soU?purpose=inline)

03\. 沙漠死亡公路

沙丘、仙人掌、峡谷、废弃加油站。沙地会降低抓地力，沙尘暴影响视线，隐藏沙丘跳台。

[Crazy Drift on Steam](https://images.openai.com/static-rsc-4/6kz1CWE17sYUuo04bbTJtURLOkUd-5Zqh4_XRj-nR8zHK-KdwB_NpmwE8wQCcWsn82fnRKckSjVWZmB_CM5F8C9gBb-KvtoHymIOXdG1bbxI0KzDc7tWGF0sviU8rJ11qQ3MFuoTN1GMI2Y70vyyiTzk2pq45GH8cr3zp_aR1_Y?purpose=inline)

04\. 雪山冰封之路

雪山、冰湖、雪松、冰洞。冰面抓地力降低，部分路段有落石和雪球障碍。

[マリオカート８ デラックス : コース | Nintendo Switch | 任天堂](https://images.openai.com/static-rsc-4/faFJ84AuVfpIl5SInogY3If_CmQlvybdFFTFXjhJVQIBZy-x6ta2Fu4hJ8Lrnkz7N9LM5477hJa6SVkMLkPPti1zYdpzQ_1WFkvRT1bhMS30VPPUuqbhiCojM5cK_UuSMXVLOSq3dq1XoMq5gHbYmWPNvONnftB-zTQlVj4987g?purpose=inline)

05\. 热带雨林

茂密森林、瀑布、木桥、泥潭。藤蔓与倒木形成障碍，隐藏穿越瀑布的捷径。

[Hot Wheels Monster Trucks: Stunt Mayhem™ on Steam](https://images.openai.com/static-rsc-4/TfnxD_TcE7rkw_njiJRP3zNRJFcl21TaqMb33Bd8WOqAXFNFI-7ywaDtLiZ64aWYrJZyuyxzsCbTOB7xZzKf8nJCzYGvzZqvXuPEsowTGTakvj5FVH-wJWdZda0a5SNVPXQ_5TMYlTw0rlhWS_nQ5JtyohgPxnk0Osg9DxSPCjc?purpose=inline)

06\. 火山熔岩环道

活火山、熔岩河、断裂岩桥。地面间歇喷发岩浆，部分平台会周期性升降。

[Docks | Drifting | OverTake.gg](https://images.openai.com/static-rsc-4/ez4howbekdIv17_5Famlwi2weG_TrJ6_SoTCr6r6YGsG2vTHrOLHZG66a1Z907Vgs787wX-SYARXQFAyFyfgZOIwjvlXx81ORBTM8ODFp9RqGvGicCVvaKl8ma31ShGC9Qcp4xwzvYMELqFu96_kZkHplkUvJJzOsx1iYPBhUrc?purpose=inline)

07\. 疯狂港口

集装箱、货轮、起重机、码头。动态吊运集装箱形成障碍，可从货船甲板抄近路。

[Procedural Generation of Tracks for Racing Games](https://images.openai.com/static-rsc-4/3ug3BFQe-bAPY8t1c5B5UUho9TtXKRyg2OqQpKs8ds85Q85TwRX6ZCTDTop1R9mnLnKS1hpT7-LUZwNOLZB0yDJsVZphqI7KqJIxq4Bfj8ZcpkSoI3hIRfSzHOFGvRKL2R49dtOqpyesDVqAR8TEvr_yE2VDJqCxu2Yv3RIaQVA?purpose=inline)

08\. 乡村农场

麦田、风车、谷仓、牲畜。拖拉机和干草堆阻碍通行，偶尔有动物横穿道路。

[Aether Arena Runners - 3D Racing by Jabali AI](https://images.openai.com/static-rsc-4/0rRcql6he1bR88R0uTRnu9CuIMoHRglMqdFE-ebmIrPen7fTZFwPqUR8P3oQlYqrQRKszo0cwvz7UVwZatBXE5IhoteKzLy7kc7ps9QYpToldgO5VQpAaj_O5ziAGsYdEMqS7BURkGfJZY4ZLzui_72qH0RlDtqZJk7PCW3mNdc?purpose=inline)

09\. 天空彩虹公路

云层、悬浮道路、彩虹桥、空中平台。连续跳台和高空捷径带来强烈速度感。

[The Making of ‘Moontopia’ for ‘Fortnite’](https://images.openai.com/static-rsc-4/gMO58JXCmmn1lRedmj6eBmMsJosmmMG9zSL0UDQy3ZXxvZXZVquYtnjyciyzlhLO8f-QLjwJXw_WaIpU9BkwP_AHLzhOdKJlMtBgMeyHFuanPNdMxu8ZWftzL477ixQ4494P_NGe2KsaPuMLVmBKzWb3bOUSlppjS8GUcj05_hI?purpose=inline)

10\. 月球疯狂竞速

月球表面、陨石坑、太空基地。低重力跳跃距离更远，漂移和落地控制更加困难。

### 4.1 赛道配置

每条赛道由统一的数据配置驱动。

```
interface TrackConfig {
  id: string;
  name: string;
  theme: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  laps: number;
  length: number;
  checkpoints: Checkpoint[];
  spawnPoints: Vector3[];
  obstacles: ObstacleConfig[];
  shortcuts: ShortcutConfig[];
  weather: string[];
  music: string;
}
```

### 4.2 赛道通用功能

- 起点与终点。
- 检查点与圈数验证。
- 8 名骑手出生位置。
- 动态障碍物。
- 道具刷新位置。
- 捷径路线。
- AI 路径导航。
- 赛道边界与掉落重生。
- 小地图。
- 环境音效和专属背景音乐。

所有赛道必须支持重新开始、暂停、返回菜单以及比赛结束结算。

## 五、游戏模式

| 模式    | 玩法                | 解锁   |
| ----- | ----------------- | ---- |
| 快速比赛  | 选择赛道直接与 AI 竞速     | 默认   |
| 生涯模式  | 连续挑战不同赛道，解锁内容     | 默认   |
| 暴力淘汰赛 | 通过攻击使对手出局，争夺最后胜利  | 生涯解锁 |
| 计时挑战  | 无对手，挑战最快圈速        | 默认   |
| 无尽公路  | 无限延伸的道路，持续躲避障碍和战斗 | 后续版本 |
| 疯狂混战  | 强化道具和攻击频率的竞速模式    | 后续版本 |

### 5.1 生涯模式

生涯模式采用关卡式推进。

每条赛道设定三星目标：

- 一星：完成比赛。
- 二星：获得前三名。
- 三星：获得第一名并完成额外挑战。

额外挑战包括击倒指定数量的对手、完成漂移、使用特殊攻击或发现捷径。

## 六、鹈鹕角色系统

### 6.1 鹈鹕角色设计

所有角色以鹈鹕为基础，保留标志性的长嘴、喉囊、翅膀和短腿。

| 角色    | 外观        | 特点     |
| ----- | --------- | ------ |
| 经典鹈鹕  | 白色羽毛、黄色大嘴 | 属性均衡   |
| 海盗鹈鹕  | 海盗帽、眼罩    | 攻击力高   |
| 机车鹈鹕  | 墨镜、皮夹克    | 加速能力强  |
| 忍者鹈鹕  | 黑色忍者装     | 操控灵活   |
| 摇滚鹈鹕  | 莫西干发型     | 冲撞能力强  |
| 科学家鹈鹕 | 护目镜、实验服   | 道具能力强  |
| 消防员鹈鹕 | 消防头盔      | 防御力高   |
| 宇航员鹈鹕 | 太空服       | 跳跃能力强  |
| 黄金鹈鹕  | 金色羽毛      | 稀有收藏角色 |
| 机械鹈鹕  | 机械翅膀、金属嘴  | 特殊动画   |

### 6.2 角色动画

至少实现以下动画状态：

- 待机摇头。
- 张嘴叫喊。
- 摩托驾驶。
- 左右转弯身体倾斜。
- 加速俯身。
- 左右翅膀攻击。
- 大嘴啄击。
- 大嘴夹击。
- 受伤晃动。
- 摩托翻车。
- 摔倒起身。
- 获胜庆祝。
- 失败沮丧。

## 七、摩托车系统

### 7.1 摩托分类

| 类型     | 速度 | 操控 | 防御 | 特点     |
| ------ | -- | -- | -- | ------ |
| 经典街车   | 中  | 高  | 中  | 新手友好   |
| 越野摩托   | 中  | 高  | 高  | 复杂地形   |
| 超级跑车   | 极高 | 中  | 低  | 直线冲刺   |
| 重型巡航车  | 中  | 低  | 极高 | 强力冲撞   |
| 迷你滑稽摩托 | 中  | 极高 | 低  | 灵活搞怪   |
| 火箭摩托   | 极高 | 低  | 中  | 高氮气能力  |
| 水陆两栖摩托 | 高  | 中  | 中  | 特殊赛道适应 |
| 未来悬浮摩托 | 高  | 高  | 低  | 特殊漂移动画 |

### 7.2 摩托属性

每辆摩托包含以下数值：

```
interface MotorcycleStats {
  maxSpeed: number;
  acceleration: number;
  handling: number;
  braking: number;
  durability: number;
  impactPower: number;
  nitroCapacity: number;
}
```

### 7.3 自定义系统

玩家可以修改：

- 车身颜色。
- 车轮样式。
- 排气管。
- 喇叭声音。
- 尾焰特效。
- 车身贴纸。
- 鹈鹕头盔。
- 鹈鹕眼镜。
- 大嘴颜色。

MVP 优先提供预设外观，复杂部件改装放在后续版本。

## 八、AI 对手系统

### 8.1 AI 行为

AI 骑手需要表现出不同性格，而不是单纯沿着固定路线移动。

| AI 类型 | 行为            |
| ----- | ------------- |
| 稳健型   | 保持路线，较少攻击     |
| 激进型   | 主动冲撞和攻击玩家     |
| 速度型   | 优先加速和超车       |
| 防守型   | 保持安全距离，躲避攻击   |
| 捣蛋型   | 频繁使用搞怪道具      |
| 复仇型   | 被玩家攻击后短时间主动追击 |

### 8.2 AI 决策逻辑

\#chatgpt-mermaid-\_r_eg\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_eg\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_eg\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_eg\_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-\_r_eg\_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_eg\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_eg\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_eg\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_eg\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_eg\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_eg\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_eg\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_eg\_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_eg\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_eg\_ p{margin:0;}#chatgpt-mermaid-\_r_eg\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_eg\_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_eg\_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_eg\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_eg\_ .label text,#chatgpt-mermaid-\_r_eg\_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_eg\_ .node rect,#chatgpt-mermaid-\_r_eg\_ .node circle,#chatgpt-mermaid-\_r_eg\_ .node ellipse,#chatgpt-mermaid-\_r_eg\_ .node polygon,#chatgpt-mermaid-\_r_eg\_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-\_r_eg\_ .rough-node .label text,#chatgpt-mermaid-\_r_eg\_ .node .label text,#chatgpt-mermaid-\_r_eg\_ .image-shape .label,#chatgpt-mermaid-\_r_eg\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_eg\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_eg\_ .rough-node .label,#chatgpt-mermaid-\_r_eg\_ .node .label,#chatgpt-mermaid-\_r_eg\_ .image-shape .label,#chatgpt-mermaid-\_r_eg\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_eg\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_eg\_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_eg\_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_eg\_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-\_r_eg\_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-\_r_eg\_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_eg\_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_eg\_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_eg\_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-\_r_eg\_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_eg\_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_eg\_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_eg\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_eg\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_eg\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_eg\_ .icon-shape,#chatgpt-mermaid-\_r_eg\_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_eg\_ .icon-shape p,#chatgpt-mermaid-\_r_eg\_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-\_r_eg\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_eg\_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_eg\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_eg\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_eg\_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-\_r_eg\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_eg\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_eg\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_eg\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_eg\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_eg\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_eg\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_eg\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_eg\_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-\_r_eg\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_eg\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_eg\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_eg\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_eg\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_eg\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_eg\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_eg\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_eg\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_eg\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_eg\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_eg\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-\_r_eg\_ .node rect,#chatgpt-mermaid-\_r_eg\_ .node circle,#chatgpt-mermaid-\_r_eg\_ .node ellipse,#chatgpt-mermaid-\_r_eg\_ .node polygon,#chatgpt-mermaid-\_r_eg\_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_eg\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_eg\_ .node.mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_eg\_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_eg\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_eg\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}AI 更新读取赛道和周围车辆前方有障碍?减速或绕行沿路线加速附近有对手?攻击条件满足?执行攻击超车或防御继续竞速下一次决策是否是是否否

AI 必须遵守相同的基础物理规则，不允许直接瞬移超车。难度通过路线选择、反应延迟、攻击积极性和驾驶稳定性调整。

## 九、PC 与移动端操作设计

### 9.1 PC 键盘操作

| 按键    | 功能     |
| ----- | ------ |
| W / ↑ | 加速     |
| S / ↓ | 刹车     |
| A / ← | 左转     |
| D / → | 右转     |
| Space | 漂移     |
| Shift | 氮气加速   |
| J     | 左侧攻击   |
| K     | 右侧攻击   |
| L     | 大嘴特殊攻击 |
| E     | 使用道具   |
| Esc   | 暂停游戏   |
| R     | 复位摩托   |

支持同时按下转向、加速和攻击按键。

### 9.2 移动端横屏操作

移动端采用双手横屏操作。

移动端横屏 HUD 示意

16:9

示意图仅表达控制区域与信息层级，实际游戏使用 Three.js 3D 场景渲染。

### 9.3 移动端按钮布局

左手区域：

- 左转按钮。
- 右转按钮。
- 可选虚拟摇杆模式。

右手区域：

- 加速按钮。
- 漂移按钮。
- 攻击按钮。
- 氮气按钮。
- 道具按钮（获得道具后显示）。

移动端支持长按、组合按键和多点触控。

默认启用自动加速选项，让玩家可以更专注于转向与战斗；设置中允许关闭自动加速。

## 十、移动端横屏自动切换

### 10.1 核心要求

当玩家通过手机访问游戏时：

1. 自动识别移动端设备。
2. 优先使用横屏游戏布局。
3. 用户点击「开始游戏」后尝试进入全屏。
4. 在浏览器允许的情况下请求锁定为横屏。
5. 若设备当前为竖屏且无法自动切换，显示旋转设备提示。
6. 当设备切换为横屏时，自动进入或恢复游戏界面。
7. 横屏期间游戏画面与触控按钮自适应屏幕比例。

注意：普通移动网页无法保证强制旋转设备屏幕。 Android 部分浏览器可以在全屏状态下锁定横屏；iOS Safari 等环境可能不支持网页强制锁定。必须实现横屏提示作为降级方案。

### 10.2 屏幕方向处理

推荐使用：

- `screen.orientation.lock("landscape")`
- Fullscreen API
- `matchMedia("(orientation: landscape)")`
- Screen Orientation API
- CSS `aspect-ratio`
- CSS 安全区域 `env(safe-area-inset-*)`

示例逻辑：

```
async function enterLandscapeGame() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    // 全屏可能不被当前浏览器支持
  }

  try {
    if (screen.orientation?.lock) {
      await screen.orientation.lock("landscape");
    }
  } catch {
    // 无法锁定时，启用旋转设备提示
  }

  updateOrientationUI();
}

function updateOrientationUI() {
  const isPortrait = window.matchMedia(
    "(orientation: portrait)"
  ).matches;

  const isMobile = matchMobileDevice();

  if (isMobile && isPortrait) {
    showRotateDeviceOverlay();
    pauseGame();
  } else {
    hideRotateDeviceOverlay();
    resizeGameCanvas();
  }
}
```

`enterLandscapeGame()` 必须由玩家点击开始按钮等用户手势触发；浏览器不保证全屏或方向锁定成功。

### 10.3 竖屏提示界面

## 请横屏游玩

旋转手机，开启鹈鹕疯狂竞速！

仅在移动设备竖屏且无法自动切换时显示

### 10.4 屏幕适配要求

| 场景        | 行为          |
| --------- | ----------- |
| PC 横屏     | 正常运行        |
| PC 窄窗口    | 自适应 HUD     |
| 手机横屏      | 正常游戏        |
| 手机竖屏      | 尝试锁定或提示旋转   |
| 游戏中转为竖屏   | 自动暂停        |
| 恢复横屏      | 恢复布局，等待玩家继续 |
| 刘海屏 / 挖孔屏 | 按安全区域调整按钮   |
| 浏览器失去焦点   | 自动暂停        |

## 十一、3D 画面与镜头系统

### 11.1 美术风格

采用色彩明亮的卡通 Low Poly 风格。

- 鹈鹕采用夸张比例：大嘴、大脑袋、小身体。
- 摩托车采用圆润、可爱但有力量感的设计。
- 赛道环境保持简洁，突出驾驶路线。
- 使用卡通材质和柔和阴影。
- 战斗特效使用夸张的漫画化表现。
- 避免写实血腥效果。

### 11.2 摄像机系统

支持三种摄像机模式：

| 模式     | 描述              |
| ------ | --------------- |
| 第三人称追尾 | 默认视角，摄像机位于摩托后上方 |
| 近距离追尾  | 更强烈的速度感         |
| 远距离追尾  | 更容易观察对手和赛道      |

动态镜头效果：

- 加速时略微拉远并增大 FOV。
- 漂移时摄像机轻微偏移。
- 攻击命中时短暂震动。
- 跳跃时自动调整俯仰角。
- 摔车时镜头跟随角色，但限制过度旋转。
- 重生时平滑返回默认镜头。

### 11.3 视觉特效

- 氮气尾焰。
- 轮胎烟雾。
- 漂移火花。
- 羽毛粒子。
- 撞击星星。
- 大嘴攻击残影。
- 速度线。
- 道具爆炸。
- 环境沙尘、雨雪、落叶。
- 获胜彩纸与烟花。

## 十二、游戏 UI 系统

### 12.1 主菜单

主菜单以一只骑着摩托的鹈鹕为视觉中心，背景为动态 3D 海岸公路。

主菜单入口：

- 开始游戏。
- 生涯模式。
- 赛道选择。
- 鹈鹕角色。
- 摩托车库。
- 图鉴。
- 游戏设置。

### 12.2 比赛 HUD

比赛过程中展示：

- 当前名次。
- 总参赛人数。
- 当前圈数。
- 比赛时间。
- 当前速度。
- 氮气能量。
- 特殊攻击冷却。
- 当前道具。
- 赛道小地图。
- 前后方对手提示。
- 暂停按钮。

HUD 应尽量避免遮挡中央驾驶视野。

### 12.3 比赛结算

比赛结束展示：

- 最终名次。
- 完成时间。
- 最快单圈。
- 攻击命中次数。
- 击倒对手次数。
- 漂移距离。
- 获得金币。
- 解锁内容。

## 十三、音效与音乐

### 13.1 音效

| 类型   | 设计         |
| ---- | ---------- |
| 鹈鹕叫声 | 搞怪的鸟叫声     |
| 摩托引擎 | 根据转速动态变化   |
| 大嘴攻击 | 夸张的啄击和弹性音效 |
| 翅膀拍击 | 快速挥动空气声    |
| 撞击   | 卡通撞击音效     |
| 翻车   | 滑稽滚动音效     |
| 氮气   | 强烈喷射声      |
| 道具   | 独立的特殊音效    |
| 获胜   | 欢乐的庆祝音乐    |

### 13.2 背景音乐

采用快节奏、搞怪、街机风格的原创或合规授权音乐。

不同赛道可以有不同音乐主题，例如海滨赛道使用冲浪摇滚，沙漠赛道使用西部摇滚，霓虹城市使用电子音乐。

## 十四、经济与解锁系统

### 14.1 金币获取

玩家通过以下行为获取游戏金币：

- 完成比赛。
- 获得前三名。
- 攻击对手。
- 完成特殊挑战。
- 发现隐藏捷径。
- 完成生涯关卡。

### 14.2 金币用途

- 解锁鹈鹕角色。
- 购买新摩托。
- 解锁摩托涂装。
- 购买头盔与装饰。
- 解锁特殊尾焰。
- 升级摩托性能（仅限允许升级的模式）。

所有内容均可通过正常游玩获取，MVP 不加入付费系统。

## 十五、技术架构

### 15.1 技术选型

| 模块    | 技术                        |
| ----- | ------------------------- |
| 前端框架  | Vue 3                     |
| 开发语言  | TypeScript                |
| 构建工具  | Vite                      |
| 3D 渲染 | Three.js                  |
| 物理引擎  | Rapier 3D                 |
| 角色动画  | GLTF / GLB AnimationMixer |
| UI 状态 | Pinia                     |
| 音效    | Web Audio API / Howler.js |
| 模型资源  | GLB / glTF                |
| 本地存档  | IndexedDB                 |
| 部署    | 静态网站托管                    |

### 15.2 推荐项目结构

```
pelican-road-rage/
├── public/
│   ├── models/
│   │   ├── pelicans/
│   │   ├── motorcycles/
│   │   └── environments/
│   ├── textures/
│   ├── audio/
│   └── tracks/
├── src/
│   ├── core/
│   │   ├── Game.ts
│   │   ├── Renderer.ts
│   │   ├── Physics.ts
│   │   ├── Camera.ts
│   │   └── InputManager.ts
│   ├── entities/
│   │   ├── Pelican.ts
│   │   ├── Motorcycle.ts
│   │   ├── AIController.ts
│   │   └── Projectile.ts
│   ├── systems/
│   │   ├── RacingSystem.ts
│   │   ├── CombatSystem.ts
│   │   ├── DriftSystem.ts
│   │   ├── NitroSystem.ts
│   │   ├── TrackSystem.ts
│   │   ├── RespawnSystem.ts
│   │   └── SaveSystem.ts
│   ├── tracks/
│   │   ├── TrackLoader.ts
│   │   ├── TrackConfig.ts
│   │   └── CheckpointSystem.ts
│   ├── ai/
│   │   ├── AIBehavior.ts
│   │   ├── PathFollower.ts
│   │   └── OvertakePlanner.ts
│   ├── controls/
│   │   ├── KeyboardControls.ts
│   │   ├── TouchControls.ts
│   │   └── OrientationManager.ts
│   ├── ui/
│   │   ├── MainMenu.vue
│   │   ├── RaceHUD.vue
│   │   ├── TrackSelect.vue
│   │   ├── Garage.vue
│   │   ├── Results.vue
│   │   └── RotateScreen.vue
│   ├── stores/
│   ├── utils/
│   ├── App.vue
│   └── main.ts
├── package.json
└── vite.config.ts
```

### 15.3 核心架构要求

游戏逻辑与 UI 分离：

- Vue 负责菜单、HUD、设置、结算等界面。
- Three.js 负责 3D 场景和角色渲染。
- Rapier 负责碰撞和物理计算。
- 独立游戏循环处理车辆、AI 和战斗。
- 赛道使用数据驱动加载。
- 游戏设置和存档在本地保存。

物理更新建议使用固定时间步长，例如 60Hz，渲染根据设备性能动态调整。

## 十六、性能优化

### 16.1 性能目标

| 指标    | PC     | 移动端       |
| ----- | ------ | --------- |
| 目标帧率  | 60 FPS | 30–60 FPS |
| 同场骑手  | 8      | 8         |
| 阴影    | 中高质量   | 低至中质量     |
| 粒子效果  | 完整     | 简化        |
| 画面分辨率 | 自适应    | 动态渲染比例    |
| 远景模型  | LOD    | LOD + 简化  |
| 特效    | 完整     | 限制数量      |

### 16.2 优化措施

- 使用低多边形模型。
- 使用 Draco / Meshopt 压缩模型。
- 使用 KTX2 压缩纹理。
- 静态物体尽量使用实例化渲染。
- 远景物体采用 LOD。
- 赛道分区加载。
- 粒子使用对象池。
- 降低移动端实时阴影开销。
- 对远距离 AI 降低行为决策频率。
- 不可见物体执行视锥剔除。
- 根据帧率动态调整渲染比例。

## 十七、存档系统

游戏使用本地存档，无需注册账号。

需要保存的数据：

```
interface GameSave {
  version: number;
  coins: number;
  unlockedPelicans: string[];
  unlockedMotorcycles: string[];
  unlockedTracks: string[];
  careerProgress: Record<string, number>;
  bestLapTimes: Record<string, number>;
  equippedPelican: string;
  equippedMotorcycle: string;
  settings: {
    musicVolume: number;
    soundVolume: number;
    graphicsQuality: string;
    autoAccelerate: boolean;
    touchLayout: string;
  };
}
```

需要支持存档版本迁移、异常数据恢复、重置存档以及导入导出存档文件。

## 十八、开发阶段规划

阶段一：核心原型（MVP）
P0
- 8 名参赛骑手。
- 基础驾驶、漂移、氮气。
- 翅膀攻击、大嘴啄击。
- 基础 AI。
- 排名、圈数、比赛结算。
- PC 键盘和移动端横屏触控。
- 大嘴夹击系统。
- 快速比赛与生涯模式。
- 金币和解锁系统。
- 音效与视觉特效。
- 完成 10 条赛道。
- 完成 10 种鹈鹕角色。
- 完成 8 种摩托。
- 10 种战斗道具。
- 暴力淘汰赛和计时挑战。
- 摩托外观定制。
- 图鉴与成就。
- 移动端性能深度优化。



## 十九、验收标准

| 功能    | 验收要求              |
| ----- | ----------------- |
| 游戏启动  | PC 和主流移动浏览器可以进入游戏 |
| 3D 驾驶 | 加速、转向、刹车、漂移正常     |
| 战斗系统  | 攻击判定正确，命中后有明显反馈   |
| AI 竞速 | 7 名 AI 能够独立完成比赛   |
| 排名系统  | 实时名次与最终名次正确       |
| 赛道系统  | 检查点、圈数和捷径验证正常     |
| 摩托翻车  | 可以恢复，不会永久卡住       |
| 移动端横屏 | 支持锁定时尝试横屏，否则提示旋转  |
| 移动端触控 | 支持多指同时操作，无明显误触    |
| 游戏暂停  | 页面失焦或竖屏时正确暂停      |
| 游戏存档  | 刷新页面后进度保留         |
| 性能    | 在目标测试设备上达到对应帧率目标  |

## 二十、关键风险与解决方案

| 风险          | 解决方案                   |
| ----------- | ---------------------- |
| 3D 摩托物理容易翻车 | 采用街机式平衡辅助、车身倾斜动画与简化碰撞体 |
| AI 车辆容易相互卡住 | 结合路径跟随、局部避障和卡死检测       |
| 鹈鹕大嘴攻击穿模    | 使用独立命中盒、动作窗口和碰撞过滤      |
| 移动端性能不足     | 动态画质、LOD、减少粒子和阴影       |
| 浏览器无法强制横屏   | 横屏锁定请求 + 旋转提示降级        |
| 赛道开发工作量大    | 建立模块化赛道组件和配置系统         |
| 摔车动画影响比赛节奏  | 限制失控时间，提供快速重生          |
| 手机触控按钮过多    | 支持自动加速、按钮合并和布局自定义      |

## 二十一、最终产品定位

《鹈鹕暴力摩托》应当是一款操作简单、战斗搞笑、速度刺激、随时可以打开网页玩一局的 3D 竞速游戏。

设计重点不是高度拟真的摩托驾驶，而是让玩家享受以下体验：

骑着摩托的鹈鹕在高速公路上狂飙，一边漂移超车，一边用巨大的嘴巴把其他鹈鹕骑手啄飞。