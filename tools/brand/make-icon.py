#!/usr/bin/env python3
# Usage: python3 tools/brand/make-icon.py [rocket position in degrees, default 50]
# Generates icon.svg with the rocket placed exactly on the orbit ring and
# pointing along it (tangent), its exhaust trailing back along the ring.
import math, sys
CX, CY = 252, 286          # planet centre = ring centre (a circular orbit seen at an angle)
RX, RY = 206, 76           # ring radii
TILT = -22                 # ring tilt, degrees (SVG: negative = counter-clockwise)
PR = 94                    # planet radius
T = float(sys.argv[1]) if len(sys.argv) > 1 else 50   # rocket position on the ring, degrees
SCALE = 0.70               # rocket size

ct, st = math.cos(math.radians(TILT)), math.sin(math.radians(TILT))
def ring(t):
    a = math.radians(t)
    x, y = RX * math.cos(a), RY * math.sin(a)
    return CX + x * ct - y * st, CY + x * st + y * ct
def tangent(t):  # direction of motion: decreasing t (up the right-hand side)
    a = math.radians(t)
    dx, dy = RX * math.sin(a), -RY * math.cos(a)
    return math.degrees(math.atan2(dx * st + dy * ct, dx * ct - dy * st))

rx_, ry_ = ring(T)
ang = tangent(T)
# Trail: the arc behind the rocket, fading out.
trail_pts = [ring(T + k) for k in range(0, 95, 3)]
trail = 'M ' + ' L '.join(f'{x:.1f} {y:.1f}' for x, y in trail_pts)
tx, ty = trail_pts[-1]

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="32%" cy="22%" r="95%">
      <stop offset="0" stop-color="#1c2558"/>
      <stop offset="0.55" stop-color="#0b0f26"/>
      <stop offset="1" stop-color="#04050c"/>
    </radialGradient>
    <radialGradient id="planet" cx="36%" cy="32%" r="72%">
      <stop offset="0" stop-color="#a9d6ff"/>
      <stop offset="0.45" stop-color="#5a9be8"/>
      <stop offset="0.85" stop-color="#2a5aa8"/>
      <stop offset="1" stop-color="#18336e"/>
    </radialGradient>
    <radialGradient id="night" cx="72%" cy="76%" r="70%">
      <stop offset="0" stop-color="#030714" stop-opacity="0.75"/>
      <stop offset="0.55" stop-color="#030714" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#030714" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0.72" stop-color="#6fb4ff" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#6fb4ff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="flame" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0" stop-color="#fffbe0"/>
      <stop offset="0.35" stop-color="#ffc066"/>
      <stop offset="1" stop-color="#ff5a2a" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="hull" x1="0" y1="-1" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.55" stop-color="#e3e8f5"/>
      <stop offset="1" stop-color="#aab3cc"/>
    </linearGradient>
    <linearGradient id="trail" gradientUnits="userSpaceOnUse" x1="{rx_:.1f}" y1="{ry_:.1f}" x2="{tx:.1f}" y2="{ty:.1f}">
      <stop offset="0" stop-color="#b9fff0" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#7cf7d4" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
    <clipPath id="disc"><circle cx="{CX}" cy="{CY}" r="{PR}"/></clipPath>
    <!-- In the ring's own frame, its lower half passes in front of the planet. -->
    <clipPath id="front"><rect x="-300" y="0" width="600" height="300"/></clipPath>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <g fill="#fff">
    <circle cx="86" cy="92" r="3.6" opacity="0.85"/><circle cx="424" cy="70" r="2.6" opacity="0.6"/>
    <circle cx="462" cy="318" r="3" opacity="0.65"/><circle cx="62" cy="404" r="2.6" opacity="0.5"/>
    <circle cx="300" cy="50" r="2.2" opacity="0.5"/><circle cx="170" cy="472" r="2.2" opacity="0.4"/>
    <circle cx="372" cy="452" r="1.8" opacity="0.45"/><circle cx="140" cy="168" r="1.6" opacity="0.4"/>
    <path d="M 386 140 l 3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3 z" opacity="0.8"/>
  </g>
  <!-- ring, back half -->
  <g transform="translate({CX} {CY}) rotate({TILT})">
    <ellipse cx="0" cy="0" rx="{RX}" ry="{RY}" fill="none" stroke="#7cf7d4" stroke-width="9" opacity="0.28"/>
  </g>
  <!-- planet -->
  <circle cx="{CX}" cy="{CY}" r="{PR + 16}" fill="url(#halo)"/>
  <circle cx="{CX}" cy="{CY}" r="{PR}" fill="url(#planet)"/>
  <g clip-path="url(#disc)" opacity="0.18" fill="#ffffff">
    <ellipse cx="{CX - 10}" cy="{CY - 38}" rx="110" ry="9"/>
    <ellipse cx="{CX + 20}" cy="{CY + 6}" rx="120" ry="7"/>
    <ellipse cx="{CX - 6}" cy="{CY + 46}" rx="110" ry="8"/>
  </g>
  <circle cx="{CX}" cy="{CY}" r="{PR}" fill="url(#night)"/>
  <!-- ring, front half -->
  <g transform="translate({CX} {CY}) rotate({TILT})">
    <ellipse cx="0" cy="0" rx="{RX}" ry="{RY}" fill="none" stroke="#7cf7d4" stroke-width="9" clip-path="url(#front)"/>
  </g>
  <!-- the rocket's path behind it, glowing and fading -->
  <path d="{trail}" fill="none" stroke="url(#trail)" stroke-width="26" stroke-linecap="round" filter="url(#glow)"/>
  <path d="{trail}" fill="none" stroke="url(#trail)" stroke-width="9" stroke-linecap="round"/>
  <!-- rocket, centred on the ring and pointing along it -->
  <g transform="translate({rx_:.1f} {ry_:.1f}) rotate({ang:.1f}) scale({SCALE})">
    <path d="M -50 -13 Q -150 0 -50 13 Z" fill="url(#flame)"/>
    <path d="M -50 -8 Q -96 0 -50 8 Z" fill="#fffbe0" opacity="0.9"/>
    <path d="M -44 -24 L -72 -50 L -58 -50 L -24 -24 Z" fill="#e0574a"/>
    <path d="M -44 24 L -72 50 L -58 50 L -24 24 Z" fill="#c4473b"/>
    <rect x="-56" y="-14" width="14" height="28" rx="4" fill="#6b7591"/>
    <path d="M 70 0 C 58 -20 34 -27 10 -27 L -44 -27 Q -50 -27 -50 -21 L -50 21 Q -50 27 -44 27 L 10 27 C 34 27 58 20 70 0 Z" fill="url(#hull)" stroke="#7d88a8" stroke-width="4"/>
    <path d="M 70 0 C 62 -13 52 -19 40 -23 L 40 23 C 52 19 62 13 70 0 Z" fill="#e0574a"/>
    <circle cx="12" cy="0" r="11" fill="#4fc3ff" stroke="#2a6a9a" stroke-width="4"/>
    <circle cx="9" cy="-3" r="3.5" fill="#ffffff" opacity="0.8"/>
  </g>
</svg>
'''
open(sys.argv[2] if len(sys.argv) > 2 else __import__('os').path.join(__import__('os').path.dirname(__file__), '..', '..', 'icon.svg'), 'w').write(svg)
print(f'rocket at ({rx_:.1f},{ry_:.1f}) heading {ang:.1f} deg; distance from centre {math.hypot(rx_-CX, ry_-CY):.0f}')
