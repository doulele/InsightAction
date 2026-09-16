#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
观止知行 · tabBar 图标生成器
============================

为三种模式各生成一套 tabBar 图标（观/止/知/行/我 × 未选中/选中）：

  normal  普通 EARTH  —— 圆润实心、有机曲线（纸墨 · 温暖）
  tech    科技 LAB    —— 极简线框、几何网格（暗色 · 电光蓝）
  dao     修仙 DAO    —— 水墨意象、云纹圆月（墨金 · 青绿）

产物：src/static/tabbar/<mode>/<tab>[_on].png  (81×81, RGBA)

用法：
  python scripts/build-tabbar-icons.py            # 生成全部
  python scripts/build-tabbar-icons.py --preview  # 额外输出一张对照大图
"""

import argparse
import math
import os
from PIL import Image, ImageDraw

# ---------------------------------------------------------------- 基础配置

SIZE = 81          # 小程序建议 81×81
SS = 8             # 超采样倍数（保证曲线平滑）
CANVAS = SIZE * SS
U = CANVAS / 100.0  # 逻辑坐标 100 → 画布像素

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src', 'static', 'tabbar')

# 模式配色（与 src/config/skins.ts 保持一致）
COLORS = {
    'normal': {'off': '#A9A196', 'on': '#5F7F4E', 'halo': (95, 127, 78, 34)},
    'tech':   {'off': '#66748A', 'on': '#3FA9FF', 'halo': (63, 169, 255, 32)},
    'dao':    {'off': '#7A7360', 'on': '#D0A85F', 'halo': (208, 168, 95, 32)},
}

TABS = ['observe', 'pause', 'reflect', 'action', 'me']


def rgba(hex_color: str, alpha: int = 255):
    h = hex_color.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


# ---------------------------------------------------------------- 绘制工具

class Pen:
    """把 0-100 的逻辑坐标映射到超采样画布，并封装常用图元。"""

    def __init__(self, draw: ImageDraw.ImageDraw):
        self.d = draw

    def pt(self, x, y):
        return (x * U, y * U)

    def box(self, x0, y0, x1, y1):
        return (x0 * U, y0 * U, x1 * U, y1 * U)

    def line(self, pts, w, fill):
        self.d.line([self.pt(*p) for p in pts], width=max(1, int(w * U)), fill=fill, joint='curve')

    def circle(self, cx, cy, r, fill=None, outline=None, w=1):
        b = self.box(cx - r, cy - r, cx + r, cy + r)
        if fill is not None:
            self.d.ellipse(b, fill=fill)
        if outline is not None:
            self.d.ellipse(b, outline=outline, width=max(1, int(w * U)))

    def ring(self, cx, cy, r, w, fill):
        self.d.ellipse(self.box(cx - r, cy - r, cx + r, cy + r), outline=fill, width=max(1, int(w * U)))

    def rrect(self, x0, y0, x1, y1, r, fill=None, outline=None, w=1):
        self.d.rounded_rectangle(
            self.box(x0, y0, x1, y1), radius=int(r * U), fill=fill,
            outline=outline, width=max(1, int(w * U)) if outline else 0,
        )

    def poly(self, pts, fill=None, outline=None, w=1):
        self.d.polygon([self.pt(*p) for p in pts], fill=fill, outline=outline,
                       width=max(1, int(w * U)) if outline else 0)

    def arc(self, x0, y0, x1, y1, a0, a1, w, fill):
        self.d.arc(self.box(x0, y0, x1, y1), a0, a1, fill=fill, width=max(1, int(w * U)))

    def pie(self, x0, y0, x1, y1, a0, a1, fill):
        self.d.pieslice(self.box(x0, y0, x1, y1), a0, a1, fill=fill)

    @staticmethod
    def quad(p0, p1, p2, n=54):
        """二次贝塞尔采样成折线，用来画平滑曲线。"""
        pts = []
        for i in range(n + 1):
            t = i / n
            mt = 1 - t
            x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0]
            y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]
            pts.append((x, y))
        return pts

    @staticmethod
    def polar(cx, cy, r, deg):
        a = math.radians(deg)
        return (cx + math.cos(a) * r, cy + math.sin(a) * r)


# ---------------------------------------------------------------- 共用的「收集形」与「足印」

def collect_tray(p, c):
    """「观」共用的收集形：开口托盘 + 三条落下的信息线。

    语义是「把信息收进来」（对应观大厅里的收件箱 / 稍后读 / 信息源），
    不再是眼睛 —— 眼睛只说「看见」，而这一环的动词是「搜集」。
    托盘靠「实心外框挖掉内部上部」做法做出开口（挖空会影响之后画的像素，
    所以必须先把托盘画完，再画落线）。
    """
    p.rrect(16, 44, 84, 86, 8, fill=c)                  # 盒体
    p.rrect(23, 34, 77, 79, 5, fill=(0, 0, 0, 0))       # 挖出开口
    # 三条线从上方「两侧 + 中间」一起汇进盒内：越往下越向中心靠，收拢感才出得来；
    # 线本身带波浪（像信息流），用垂直于路径的正弦扰动做出来。
    for x0, y0, x1, y1 in ((26.0, 12.0, 38.0, 44.0),      # 左
                           (50.0, 10.0, 50.0, 44.0),      # 中
                           (74.0, 12.0, 62.0, 44.0)):     # 右
        pts = []
        for i in range(41):
            t = i / 40.0
            y = y0 + (y1 - y0) * t
            # 横摆的相位只跟 y 走：三条线在同一高度偏移相同，永远平行、不会缠在一起
            x = x0 + (x1 - x0) * t + 3.5 * math.sin(2 * math.pi * (y - 12.0) / 16.0)
            pts.append((x, y))
        p.line(pts, 7.0, c)
        p.circle(pts[0][0], pts[0][1], 3.5, fill=c)

#
# 「行」= 一枚空心脚印，照参考图标：足底一整条闭合描边 + 四个并拢的空心趾环。
# 照图量出的两条硬比例（之前"看着和别人差很多"的根因就在这里）：
#   ① 足底 高 ≈ 宽的 2.1 倍（瘦长）；② 趾跨度 ≈ 足底宽的 1.6 倍。
# 另外轮廓不手搭贝塞尔 —— 控制点差一点就在肩、腰处拧出折角，改用样条穿过关键点。

# 足底关键点（闭合；顺序 = 上缘 → 右侧 → 底 → 左侧），样条穿过它们。
# 照参考图的宽剖面（最宽 36 → 腰 20.5 → 脚跟 22 → 底半圆）：
# 左侧是"单调内收"的一条长弧，绝不能收完再鼓出去 —— 那就成了葫芦，不是脚。
# 前掌上缘的高度是让出来的：趾下缘到足底上缘必须留 4 个单位以上的缝（参考图是 7.6），
# 贴上了就变成"五个柿饼粘在一块面饼上"，谁也不像。
FOOT_SPINE = [(33.8, 33.5), (41.5, 26.5), (50.6, 25.0), (59.5, 26.5),   # 前掌：上缘走弧（不是平顶）
              (67.5, 31.5), (69.2, 38.0), (66.5, 46.0),                 # 右上：最宽处给一段平台，别成"尖肩"
              (61.5, 53.0), (60.0, 62.0),                               # 腰（右，凹弧最深）
              (60.0, 70.0), (60.0, 78.0), (60.0, 84.0),                 # 脚跟（右）—— 腰以下基本等宽
              (57.9, 91.6), (49.0, 96.8), (40.1, 91.6),                 # 底缘（走圆弧）
              (38.0, 84.0), (38.0, 78.0), (38.0, 70.0),                 # 脚跟（左）
              (38.5, 62.0), (38.5, 53.0),                               # 腰（左，平缓内收）
              (35.2, 45.8), (33.2, 38.0)]                               # 左下弧
# 关键点一律加密到彼此相距 6~10：样条在点距突变的地方会鼓出一个小尖，
# 底缘和左下弧是最长的两段，原先一根线拉 16~18 个单位，正是最容易鼓尖的位置
FOOT_SPAN_Y = (2.2, 98.6)                # 整体（含趾 + 半个线宽）纵向范围：用来把画心对齐几何中心
FOOT_TOES = [(26.93, 15.5, 7.0),         # 四趾 (x, y, r)：左大右小、趾心沿一条缓弧
             (43.60, 10.5, 6.5),         # 相邻圆心距 = 半径和 + 线宽 + 0.3 —— 描边刚好相切。
             (59.99, 11.0, 6.0),         # 注意要按**圆心距**算，不是横向差：趾心不在同一高度，
             (74.56, 16.0, 5.5)]         # 只按 dx 排会让两边多出约 1 个单位的缝（踩过一次）。
FOOT_SCALE = 1.0                         # 关键点已按画心排好，这里只留统一缩放的余地
FOOT_LINE = 3.6                          # 描边线宽：足底轮廓与趾环同一粗细
FOOT_CENTER = (50.0, 50.0)


def _mix(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def spline(points, per_seg=20, alpha=0.5):
    """闭合的**向心** Catmull-Rom：穿过全部关键点（Barry–Goldman 递推）。

    为什么不用手搭贝塞尔：足底是"上宽 → 收腰 → 圆跟"的复合曲线，
    控制点差一点，曲率就在肩、腰处拧出折角，看着立刻不像脚。

    alpha=0.5 是"向心参数化"：节点间距按真实距离的平方根给。改它是有代价的 ——
    均匀参数化（alpha=0）在相邻关键点点距差一倍时会自己兜出去一个小尖，
    底缘 / 左下弧这类长段正是最容易鼓尖的地方。所以关键点也一并加密到等距（6~10）。
    """
    n = len(points)
    pts = points + points[:3]          # 闭合：末尾接上开头三个点
    out = []
    for i in range(n):
        p0, p1, p2, p3 = pts[i], pts[i + 1], pts[i + 2], pts[i + 3]
        t0 = 0.0
        t1 = t0 + math.dist(p0, p1) ** alpha
        t2 = t1 + math.dist(p1, p2) ** alpha
        t3 = t2 + math.dist(p2, p3) ** alpha
        if min(t1 - t0, t2 - t1, t3 - t2) <= 1e-9:
            continue                   # 重合点：这一段不出点
        for j in range(per_seg):
            t = t1 + (t2 - t1) * j / float(per_seg)
            a1 = _mix(p0, p1, (t - t0) / (t1 - t0))
            a2 = _mix(p1, p2, (t - t1) / (t2 - t1))
            a3 = _mix(p2, p3, (t - t2) / (t3 - t2))
            b1 = _mix(a1, a2, (t - t0) / (t2 - t0))
            b2 = _mix(a2, a3, (t - t1) / (t3 - t1))
            out.append(_mix(b1, b2, (t - t1) / (t2 - t1)))
    out.append(out[0])
    return out


def foot_outline():
    """足底轮廓：一条闭合样条。左右不对称 —— 左半更外凸、右半的腰收得更深。"""
    return spline(FOOT_SPINE)


def foot_print(p, c, cx, cy, s, deg):
    """一枚空心脚印：足底沿轮廓描边 + 四个并拢趾环，都走同一套缩放/平移/旋转。"""
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    mid = (FOOT_SPAN_Y[0] + FOOT_SPAN_Y[1]) / 2.0   # 整体（含趾）纵向中心 → 对齐画心

    def place(x, y):
        px, py = (x - 50) * s, (y - mid) * s
        return (cx + px * ca - py * sa, cy + px * sa + py * ca)

    p.line([place(x, y) for x, y in foot_outline()], FOOT_LINE * s, c)
    for x, y, r in FOOT_TOES:
        tx, ty = place(x, y)
        p.ring(tx, ty, r * s, FOOT_LINE * s, c)


def footprint(p, c, dy=0.0):
    """一枚足印（单枚，居中占满画心）。"""
    cx, cy = FOOT_CENTER
    foot_print(p, c, cx, cy + dy, FOOT_SCALE, 0.0)


# ---------------------------------------------------------------- 普通模式 EARTH：圆润实心

def n_observe(p, c, w):
    """观 —— 收取盒：三路信息从两侧与中间汇入（与修仙同一形）"""
    collect_tray(p, c)


def n_pause(p, c, w):
    """止 —— 水波纹：三道等长的浪，上下叠着铺开"""
    for y0, x0, x1 in ((32.0, 20.0, 80.0), (54.0, 20.0, 80.0), (76.0, 20.0, 80.0)):
        pts = []
        for i in range(49):
            t = i / 48.0
            pts.append((x0 + (x1 - x0) * t, y0 + 5.0 * math.sin(2 * math.pi * t)))
        p.line(pts, 7.0, c)
        for pt in (pts[0], pts[-1]):
            p.circle(pt[0], pt[1], 3.5, fill=c)


def n_reflect(p, c, w):
    """知 —— 螺旋：把外面的东西卷进来（内化）"""
    pts = []
    for i in range(81):
        t = i / 80.0
        pts.append(p.polar(50, 50, 3 + t * 32, 20 + t * 630))   # 约 1.75 圈
    p.line(pts, 6.5, c)
    p.circle(pts[-1][0], pts[-1][1], 3.2, fill=c)


def n_action(p, c, w):
    """行 —— 一枚足印（踏实落下，不再是上行箭头）"""
    footprint(p, c)


def n_me(p, c, w):
    """我 —— 人形轮廓：头环 + 肩弧（其余四形都是线条/描边，这里不能再是实心块）"""
    p.ring(50, 33, 13, w, c)
    p.arc(14, 51, 86, 107, 182, 358, w, c)


# ---------------------------------------------------------------- 科技模式 LAB：极简线框

def t_observe(p, c, w):
    """观 —— 取景框四角 + 准心"""
    corners = [((20, 42), (20, 24), (38, 24)), ((80, 42), (80, 24), (62, 24)),
               ((20, 58), (20, 76), (38, 76)), ((80, 58), (80, 76), (62, 76))]
    for seg in corners:
        p.line(list(seg), w, c)
    p.ring(50, 50, 16, w, c)
    p.circle(50, 50, 5, fill=c)


def t_pause(p, c, w):
    """止 —— 顶部开口的进度环 + 暂停双杠"""
    p.arc(14, 14, 86, 86, 232, 572, w, c)   # 顺时针 232°→572°(=212°)，缺口留在正上方
    p.rrect(36, 33, 45, 67, 2.5, fill=c)
    p.rrect(55, 33, 64, 67, 2.5, fill=c)


def t_reflect(p, c, w):
    """知 —— 三节点网络"""
    a, b, d = (26, 30), (74, 30), (50, 74)
    p.line([a, b], w - 1, c)
    p.line([a, d], w - 1, c)
    p.line([b, d], w - 1, c)
    for (x, y) in (a, b, d):
        p.circle(x, y, 11, fill=c)


def t_action(p, c, w):
    """行 —— 上行折线 + 端点 + 基线"""
    p.line([(16, 86), (84, 86)], w - 2, c)
    p.line([(17, 72), (37, 53), (54, 62), (74, 30)], w + 1, c)
    p.circle(74, 30, 8, fill=c)


def t_me(p, c, w):
    """我 —— 环形头像框 + 线框人形"""
    p.ring(50, 50, 33, w, c)
    p.circle(50, 36, 12, fill=c)
    p.arc(21, 54, 79, 100, 182, 358, w, c)


# ---------------------------------------------------------------- 修仙模式 DAO：水墨意象

def d_observe(p, c, w):
    """观 —— 收集托盘（与普通同形，按 dao 配色；丹凤眼随语义改动一并退场）"""
    collect_tray(p, c)


def d_pause(p, c, w):
    """止 —— 太极（阴阳相济，止息）"""
    p.pie(15, 15, 85, 85, 180, 360, fill=c)          # 上半为阳
    p.circle(66, 50, 17, fill=c)                     # 阳中含阴之界
    p.pie(18, 33, 50, 67, 180, 360, fill=(0, 0, 0, 0))  # 阴中留白（挖出 S 曲线）
    p.circle(34, 50, 5, fill=c)                      # 阴中之阳
    p.circle(66, 50, 5, fill=(0, 0, 0, 0))           # 阳中之阴
    p.ring(50, 50, 35, w, c)


def d_reflect(p, c, w):
    """知 —— 灵珠顿悟（放射灵光 + 断弧）"""
    for deg in range(0, 360, 45):
        a, b = p.polar(50, 50, 25, deg + 22.5), p.polar(50, 50, 35, deg + 22.5)
        p.line([a, b], w - 1, c)
    p.circle(50, 50, 15, fill=c)
    p.arc(8, 8, 92, 92, 196, 254, 3, c)
    p.arc(8, 8, 92, 92, 16, 74, 3, c)


def d_action(p, c, w):
    """行 —— 一枚足印（踏实落下，去掉上行箭头与踏云装饰）"""
    footprint(p, c)


def d_me(p, c, w):
    """我 —— 圆月中的打坐人"""
    p.ring(50, 50, 34, w, c)
    p.circle(50, 34, 11, fill=c)
    p.poly([(29, 79), (71, 79), (50, 49)], fill=c)


# ---------------------------------------------------------------- 组装

SHAPES = {
    'normal': {'observe': n_observe, 'pause': n_pause, 'reflect': n_reflect, 'action': n_action, 'me': n_me},
    'tech':   {'observe': t_observe, 'pause': t_pause, 'reflect': t_reflect, 'action': t_action, 'me': t_me},
    'dao':    {'observe': d_observe, 'pause': d_pause, 'reflect': d_reflect, 'action': d_action, 'me': d_me},
}

# 不同形态的线条基准粗细（逻辑单位）
WIDTH = {'normal': 7.0, 'tech': 5.6, 'dao': 6.2}


def render(mode: str, tab: str, active: bool) -> Image.Image:
    img = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    p = Pen(d)

    conf = COLORS[mode]
    color = rgba(conf['on'] if active else conf['off'])

    # 选中态：加一圈淡淡的柔光底盘，让状态在 tabBar 上一眼可辨
    if active:
        p.circle(50, 50, 41, fill=conf['halo'])

    SHAPES[mode][tab](p, color, WIDTH[mode])

    return img.resize((SIZE, SIZE), Image.LANCZOS)


def check_geometry():
    """脚印几何自检 —— 三个踩过的坑，改完参数跑一次 python build-tabbar-icons.py --check。

    ① 趾必须按**圆心距**算相切（趾心不同高，只按 dx 排会两边多出约 1 个单位的缝）；
    ② 趾下缘到足底轮廓要留 3 个单位以上（贴上了就糊成一坨，谁也不像）；
    ③ 轮廓样条不能自己兜出去一个尖（点距突变处最容易发生，所以关键点要等距）。
    """
    ok = True
    print('== 趾环相切（描边间隙应 ≈ 0.3 单位）')
    for i in range(len(FOOT_TOES) - 1):
        x0, y0, r0 = FOOT_TOES[i]
        x1, y1, r1 = FOOT_TOES[i + 1]
        gap = math.dist((x0, y0), (x1, y1)) - (r0 + r1) - FOOT_LINE
        ok &= abs(gap - 0.3) < 0.1
        print(f'   趾{i + 1}-趾{i + 2}: {gap:.2f}')
    print('== 趾 ↔ 足底净间隙（应 > 3 单位）')
    outline = foot_outline()
    for i, (x, y, r) in enumerate(FOOT_TOES):
        gap = min(math.dist((x, y), (px, py)) for px, py in outline) - r - FOOT_LINE
        ok &= gap > 3.0
        print(f'   趾{i + 1}: {gap:.2f} 单位 = {gap * 0.81:.1f}px（81px 画布）')
    print('== 轮廓平顺度（最大偏转角越小越顺）')
    pts = outline
    worst = 0.0
    for i in range(1, len(pts) - 1):
        a0 = math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])
        a1 = math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0])
        d = math.degrees(a1 - a0)
        worst = max(worst, abs((d + 180) % 360 - 180))
    ok &= worst < 8.0
    print(f'   最大偏转 {worst:.2f}°（阈值 8°）')
    print('\n' + ('✓ 几何自检通过' if ok else '✗ 有项不达标，见上'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', action='store_true', help='额外生成一张对照预览图')
    ap.add_argument('--check', action='store_true', help='只做脚印几何自检，不生成 PNG')
    args = ap.parse_args()

    if args.check:
        check_geometry()
        return

    total = 0
    for mode in ('normal', 'tech', 'dao'):
        out_dir = os.path.join(OUT_DIR, mode)
        os.makedirs(out_dir, exist_ok=True)
        for tab in TABS:
            for active in (False, True):
                name = f'{tab}_on.png' if active else f'{tab}.png'
                render(mode, tab, active).save(os.path.join(out_dir, name))
                total += 1
        print(f'  ✓ {mode:6s} → {out_dir}')

    if args.preview:
        cell, gap = 96, 26
        w = gap + (cell + gap) * len(TABS)
        h = gap + (cell + gap) * 3
        sheet = Image.new('RGBA', (w, h), (24, 24, 28, 255))
        for r, mode in enumerate(('normal', 'tech', 'dao')):
            for ci, tab in enumerate(TABS):
                for k, active in enumerate((False, True)):
                    x = gap + (cell + gap) * ci + k * (cell // 2 + 4)
                    y = gap + (cell + gap) * r
                    sheet.paste(render(mode, tab, active).resize((46, 46), Image.LANCZOS), (x, y),
                                render(mode, tab, active).resize((46, 46), Image.LANCZOS))
        path = os.path.join(os.path.dirname(OUT_DIR), 'tabbar-preview.png')
        sheet.save(path)
        print(f'  ✓ preview → {path}')

    print(f'\n完成：{total} 个图标（{SIZE}×{SIZE} PNG）')


if __name__ == '__main__':
    main()
