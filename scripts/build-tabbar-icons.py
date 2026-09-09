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


# ---------------------------------------------------------------- 普通模式 EARTH：圆润实心

def n_observe(p, c, w):
    """观 —— 温润的杏仁眼 + 瞳"""
    p.line(p.quad((14, 54), (50, 10), (86, 54)), w + 1, c)
    p.line(p.quad((14, 54), (50, 90), (86, 54)), w, c)
    p.circle(50, 50, 13, fill=c)


def n_pause(p, c, w):
    """止 —— 沙漏"""
    p.rrect(20, 12, 80, 24, 6, fill=c)
    p.rrect(20, 76, 80, 88, 6, fill=c)
    p.poly([(30, 24), (70, 24), (50, 50)], fill=c)
    p.poly([(30, 76), (70, 76), (50, 50)], fill=c)


def n_reflect(p, c, w):
    """知 —— 灯泡 + 光芒"""
    for deg in (-90, -155, -25):
        a, b = p.polar(50, 44, 26, deg), p.polar(50, 44, 36, deg)
        p.line([a, b], w - 1, c)
    p.circle(50, 44, 21, fill=c)
    p.rrect(39, 63, 61, 71, 4, fill=c)
    p.rrect(42, 73, 58, 80, 4, fill=c)


def n_action(p, c, w):
    """行 —— 圆润上行箭头"""
    p.poly([(50, 14), (79, 50), (21, 50)], fill=c)
    for vx, vy in ((50, 16), (77, 49), (23, 49)):
        p.circle(vx, vy, 3.5, fill=c)
    p.rrect(41, 44, 59, 86, 5, fill=c)


def n_me(p, c, w):
    """我 —— 圆头 + 肩"""
    p.circle(50, 31, 16, fill=c)
    p.pie(13, 52, 87, 100, 180, 360, fill=c)


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
    """观 —— 丹凤眼 + 瞳"""
    p.line(p.quad((12, 56), (50, 14), (88, 56)), w + 1, c)
    p.line(p.quad((12, 56), (50, 84), (88, 56)), w - 1, c)
    p.circle(50, 50, 11, fill=c)


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
    """行 —— 踏云而行（云纹 + 上行箭）"""
    p.circle(36, 68, 11, fill=c)
    p.circle(54, 62, 15, fill=c)
    p.circle(70, 69, 9, fill=c)
    p.rrect(30, 66, 76, 79, 6, fill=c)
    p.poly([(50, 12), (68, 42), (32, 42)], fill=c)
    p.rrect(44, 36, 56, 56, 3, fill=c)


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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', action='store_true', help='额外生成一张对照预览图')
    args = ap.parse_args()

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
