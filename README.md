# WindowFan Studio

A parametric OpenSCAD generator for modular 120 mm window fans. The web interface plans the full printable array and exports a ZIP containing one STL per distinct part, a quantity list, and the configuration.

## Run

```bash
docker compose up --build
# Open http://localhost:8080
```

Or install OpenSCAD locally and run `make serve`. The 3D preview loads Three.js from jsDelivr, so the browser needs internet access for that view. The generator and STL export use local OpenSCAD.

## Configure a kit

1. Enter the measured clear opening and any installation clearance to leave around the printed assembly.
2. Choose the number of 140 mm columns and rows. Click each cell to switch between a fan and a solid panel, or use a pattern preset.
3. Place the 80 mm controller column on either side or omit it. The controller occupies the bottom row; matching blanks fill rows above.
4. Let the generator split the remaining width into printable 22–220 mm side panels, or enter exact left and right panel widths. Automatic panels can be placed left, right, or split across both sides.
5. Set a top rail height of 7–100 mm, or click **Fit available height**. Zero omits the rail. Every column gets a matching rail section, including closed left and right end sections.
6. Review the fit, part quantities, and preview, then export the STL kit.

The configurator adjusts counts, clearance, rail height, or the final manual side panel when a choice cannot fit. It shows each adjustment beside the fit summary. The visible **Print list** gives the quantity for every distinct STL; **Inspect in 3D** isolates a component, and **Download STL** exports it individually. **Full configuration** lists the dimensions and row pattern, with a separate JSON download.

Changing the configuration keeps the current 3D zoom and viewing angle. **Recenter** explicitly frames the current assembly or inspected component.

If the remaining width allows another 140 mm column, the interface offers **Add fan column**. This changes the number of cells; any cell can then be changed to a solid panel.

## Dimensions

- 120 mm nominal fans with 105 mm mounting-hole pitch and approximately 25 mm fan thickness
- Fan and solid cells: 140 × 140 mm; controller column: 80 mm; end caps: 12 mm each
- Built width: `24 + 140 × columns + controller width + side panel widths`
- Built height: `140 × rows + top rail height`
- Supported opening: 200–4000 mm wide, 140–1200 mm high; up to 20 columns and 8 rows
- Side panels: 22–220 mm each; top rails: 7–100 mm high
- Row alignment keys: 4.8 mm pegs and 5.4 mm sockets

The fit display reports any unfilled height above the assembly. A zero top gap means the configured assembly covers the usable opening height. The exported `configuration.json` records measured size, clearance, columns, row pattern, panel widths, top rail, and print quantities.

## Native OpenSCAD

```bash
make parts FILLER_W=80 PANEL_W=140 TRIM_H=20
make preview FAN_COUNT=3 ROW_COUNT=2 FILLER_W=80
```

The Makefile generates individual templates and a legacy all-fan assembly preview. Use the web generator for mixed fan/solid patterns, multiple side panels, exact top rail sections, and the complete quantity list. `top_rail` can also be generated directly with `-D 'part="top_rail"' -D 'panel_w=140' -D 'trim_h=20' -D 'rail_edge="middle"'`. Edge choices are `left`, `middle`, and `right`.

## Installation and electrical notes

This is a design prototype, not a certified window appliance. Provide secure sash retention, rain protection, insect screening, strain relief, and weather sealing for the actual opening. The top rail and alignment pegs are not clamps. Check dovetail fit with a small test print; the default radial clearance is 0.3 mm. A 140 mm module fits a K1 Max by footprint, but check the actual print orientation and depth. PETG or ASA is preferable to PLA in a hot sunny window.

The controller bay has generic standoffs, not an ESP32-specific footprint. Keep electronics weatherproof. Use a suitably rated fused 12 V supply and a regulator for the ESP32. For 4-wire PWM fans, use an open-collector or open-drain driver near 25 kHz with common ground. Do not route motor power through GPIO.
