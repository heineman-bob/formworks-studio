SHELL := /bin/bash
OPENSCAD ?= openscad
SCAD := models/window_fan.scad
OUT ?= dist/stl
FILLER_W ?= 60
TRIM_H ?= 12
PANEL_W ?= 140
RAIL_EDGE ?= middle
FAN_COUNT ?= 3
ROW_COUNT ?= 2
PARTS := fan grill left_cap right_cap controller controller_lid spacer filler controller_blank top_rail trim_fan trim_controller trim_filler trim_cap
STLS := $(addprefix $(OUT)/,$(addsuffix .stl,$(PARTS)))

.PHONY: all parts preview clean serve docker-up docker-down help
all: parts
parts: $(STLS)
$(OUT):
	mkdir -p "$@"
$(OUT)/%.stl: $(SCAD) | $(OUT)
	$(OPENSCAD) --export-format binstl -o "$@" -D 'part="$*"' -D 'filler_w=$(FILLER_W)' -D 'panel_w=$(PANEL_W)' -D 'rail_edge="$(RAIL_EDGE)"' -D 'trim_h=$(TRIM_H)' $(SCAD)
preview: | $(OUT)
	$(OPENSCAD) --export-format binstl -o '$(OUT)/assembly.stl' -D 'part="assembly"' -D 'filler_w=$(FILLER_W)' -D 'fan_count=$(FAN_COUNT)' -D 'row_count=$(ROW_COUNT)' -D 'show_fan_dummies=false' $(SCAD)
serve:
	python3 app/server.py
docker-up:
	docker compose up --build -d
docker-down:
	docker compose down
clean:
	rm -rf dist/stl
help:
	@echo 'make parts FILLER_W=80 TRIM_H=20    # individual STLs'
	@echo 'make preview FAN_COUNT=3 ROW_COUNT=2 FILLER_W=80'
	@echo 'make docker-up                       # http://localhost:8080'
