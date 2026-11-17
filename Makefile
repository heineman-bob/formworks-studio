SHELL := /bin/bash
OPENSCAD ?= openscad
SCAD := models/window_fan.scad
OUT ?= dist/stl
FILLER_W ?= 60
TRIM_H ?= 16
PANEL_W ?= 140
RAIL_EDGE ?= middle
DEPTH ?= 55
SASH_SLOT_W ?= 22
SASH_ENGAGEMENT ?= 10
LOUVER_MOUNTS ?= true
COVER_DEPTH ?= 45
DOVETAIL_CLEARANCE ?= 0.30
PIN_CLEARANCE ?= 0.30
FAN_COUNT ?= 3
ROW_COUNT ?= 2
PARTS := fan grill louver fan_cover fan_cover_lid left_cap right_cap controller controller_lid spacer filler panel_lid controller_blank top_rail trim_fan trim_controller trim_filler trim_cap test_dovetail_male test_dovetail_female test_pin_male test_pin_female
STLS := $(addprefix $(OUT)/,$(addsuffix .stl,$(PARTS)))

.PHONY: all parts preview clean serve studio-build warm-cache docker-up docker-down help
all: parts
parts: $(STLS)
$(OUT):
	mkdir -p "$@"
$(OUT)/%.stl: $(SCAD) | $(OUT)
	$(OPENSCAD) --export-format binstl -o "$@" -D 'part="$*"' -D 'filler_w=$(FILLER_W)' -D 'panel_w=$(PANEL_W)' -D 'rail_edge="$(RAIL_EDGE)"' -D 'trim_h=$(TRIM_H)' -D 'frame_depth=$(DEPTH)' -D 'sash_slot_w=$(SASH_SLOT_W)' -D 'sash_engagement=$(SASH_ENGAGEMENT)' -D 'louver_mounts=$(LOUVER_MOUNTS)' -D 'cover_depth=$(COVER_DEPTH)' -D 'dovetail_clearance=$(DOVETAIL_CLEARANCE)' -D 'pin_clearance=$(PIN_CLEARANCE)' $(SCAD)
preview: | $(OUT)
	$(OPENSCAD) --export-format binstl -o '$(OUT)/assembly.stl' -D 'part="assembly"' -D 'filler_w=$(FILLER_W)' -D 'fan_count=$(FAN_COUNT)' -D 'row_count=$(ROW_COUNT)' -D 'frame_depth=$(DEPTH)' -D 'louver_mounts=$(LOUVER_MOUNTS)' -D 'dovetail_clearance=$(DOVETAIL_CLEARANCE)' -D 'pin_clearance=$(PIN_CLEARANCE)' -D 'show_fan_dummies=false' $(SCAD)
studio-build:
	npm ci --prefix studio
	npm run build --prefix studio
serve: studio-build
	python3 app/server.py
docker-up:
	docker compose up --build -d
docker-down:
	docker compose down
warm-cache:
	python3 app/prewarm.py --max-meshes=24
clean:
	rm -rf dist/stl
help:
	@echo 'make parts FILLER_W=80 TRIM_H=20 DEPTH=55 COVER_DEPTH=45    # individual STLs'
	@echo 'make preview FAN_COUNT=3 ROW_COUNT=2 FILLER_W=80 DEPTH=55'
	@echo 'make docker-up                       # http://localhost:8080'
