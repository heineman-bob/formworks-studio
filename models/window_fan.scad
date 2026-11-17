/* Modular 120 mm window fan system (mm)
   Authoring axes: X = window width; Z = vertical; Y = air flow depth.
   Interior/front face = negative Y; fan inserted from positive Y.
   Dovetails are vertical, drop-in from top (+Z), with a clearance fit.
   PRINT: lay each housing with its flat front face on the build plate.
*/
$fn = 64;
part = "assembly";  // fan, grill, left_cap, right_cap, controller, controller_lid, spacer, assembly
fan_count = 3;
row_count = 1;
filler_w = 60;
trim_h = 16;
panel_w = 140;
rail_edge = "middle"; // middle, left, right
sash_slot_w = 22;      // clear width of the sash channel, including fit allowance
sash_engagement = 10;  // how far the sash drops into the top rail
louver_mounts = true;
dovetail_clearance = 0.30; // radial clearance, mm
pin_clearance = 0.30;      // radial clearance, mm
cover_depth = 45;       // removable insulated cover, room-side projection
magnet_d = 6; magnet_h = 2; magnet_clearance = 0.20;
strike_d = 9; strike_h = 1;
cleat_clearance = 0.30; gasket_thickness = 1.2;
vertical_keys = true;
show_fan_dummies = true;
show_louvers = true;

module_w = 140;
module_h = 140;
frame_depth = 55;
fan_size = 120;
fan_thickness = 25;
fan_clearance = 0.7;
mount_pitch = 105;
mount_hole_d = 4.3;
front_flange = 4.5;
rail_height = 7.0;   // protrusion in X
rail_root_half = 3.1;
rail_head_half = 5.4;
rail_y = 16;
wire_d = 6.0;
wire_y = frame_depth/2; // centered between front and rear corner pins
wire_z = 5.2;
controller_w = 80;
cap_w = 12;
louver_screw_x = 65;
louver_screw_z = 12;     // stays clear of the low rear wiring tunnel

// Shape of tongue on RIGHT side of a body (sideX is exact outer face).
module tongue(sideX, zmin=0, height=module_h) {
    translate([0,0,zmin])
    linear_extrude(height=height)
      polygon([[sideX,rail_y-rail_root_half],
               [sideX+rail_height,rail_y-rail_head_half],
               [sideX+rail_height,rail_y+rail_head_half],
               [sideX,rail_y+rail_root_half]]);
}
// Cutout on LEFT, open throughout Z. Rail geometry aligns at module pitch.
module groove(sideX, zmin=-0.1, height=module_h+0.2) {
    translate([0,0,zmin])
    linear_extrude(height=height)
      polygon([[sideX-0.4,rail_y-rail_root_half-dovetail_clearance],
               [sideX+rail_height+dovetail_clearance,rail_y-rail_head_half-dovetail_clearance],
               [sideX+rail_height+dovetail_clearance,rail_y+rail_head_half+dovetail_clearance],
               [sideX-0.4,rail_y+rail_root_half+dovetail_clearance]]);
}
module wire_pass(width) {
    translate([-width/2-rail_height-1,wire_y,wire_z])
      rotate([0,90,0]) cylinder(d=wire_d,h=width+2*rail_height+2);
}
module circular_airway() {
    // Rounded converging entry: 122 mm mouth to a 114 mm fan throat.
    // The short profile leaves the 120 mm fan's square frame supported.
    translate([0,0,module_h/2]) rotate([-90,0,0])
      rotate_extrude(convexity=10,$fn=96)
        polygon([[0,-0.2],[61,-0.2],[60.5,0],[59,0.6],
                 [57.8,1.6],[57.1,2.8],[57,front_flange+0.3],
                 [0,front_flange+0.3]]);
}
module fastener_holes() {
    for(x=[-mount_pitch/2,mount_pitch/2], z=[module_h/2-mount_pitch/2,module_h/2+mount_pitch/2])
      translate([x,-2,z]) rotate([-90,0,0]) cylinder(d=mount_hole_d,h=front_flange+5);
}
// Four registration studs sit near the plan-view corners of every module
// wide enough to hold two across. The 12 mm end caps use two.
// Studs can be removed with vertical_keys=false for flush-top prints.
function pin_x_positions(w) = w < 20 ? [0] : [-w/2+6,w/2-6];
module stack_keys(w, height=module_h) {
    if(vertical_keys) for(x=pin_x_positions(w),y=[6,frame_depth-6])
        translate([x,y,height]) cylinder(d=4.8,h=5.5,$fn=24);
}
module stack_sockets(w) {
    if(vertical_keys) for(x=pin_x_positions(w),y=[6,frame_depth-6])
        translate([x,y,-0.1]) cylinder(d=4.8+2*pin_clearance,h=6.1,$fn=24);
}
// Separate fit coupons use the same joint geometry as full-sized modules.
module test_dovetail_male() {translate([-12.5,0,0]) cube([25,30,25]); tongue(12.5,0,25);}
module test_dovetail_female() {difference(){translate([-12.5,0,0]) cube([25,30,25]); groove(-12.5,0,25);}}
module test_pin_male() {translate([-30,0,0]) cube([60,frame_depth,8]); stack_keys(60,8);}
module test_pin_female() {difference(){translate([-30,0,0]) cube([60,frame_depth,8]); stack_sockets(60);}}
module fan_housing() {
    difference() {
        union() {
            translate([-module_w/2,0,0]) cube([module_w,frame_depth,module_h]);
            tongue(module_w/2);
            stack_keys(module_w);
        }
        groove(-module_w/2);
        stack_sockets(module_w);
        // Frame body slides into this square pocket from exterior (positive Y).
        translate([-(fan_size+fan_clearance)/2,front_flange,(module_h-fan_size-fan_clearance)/2])
          cube([fan_size+fan_clearance,frame_depth-front_flange+0.5,fan_size+fan_clearance]);
        circular_airway();
        fastener_holes();
        wire_pass(module_w);
        // Recess steel strike discs for flush countersunk M3 screws.
        for(x=[-64,64]) {
            translate([x,-0.1,15]) rotate([-90,0,0]) cylinder(d=strike_d+0.2,h=strike_h+0.3,$fn=48);
            translate([x,-0.1,15]) rotate([-90,0,0]) cylinder(d=2.5,h=9,$fn=24);
        }
        // Top keyhole pockets. Insert the cover hooks in the tall openings,
        // then lower 5 mm behind the front lips. The bottom magnets retain it.
        for(x=[-64,64]) {
            translate([x-2.5-cleat_clearance,-0.1,134])
                cube([5+2*cleat_clearance,2.2,6.1]);
            translate([x-1.5-cleat_clearance,-0.1,129])
                cube([3+2*cleat_clearance,2.2,5.1]);
            translate([x-2.5-cleat_clearance,1.9,129])
                cube([5+2*cleat_clearance,2.3,11.1]);
        }
        // Louver screws enter the solid outer rear rim. Their pilot holes are
        // entirely outside the 120.7 mm square fan insertion envelope.
        if(louver_mounts) {
            assert(frame_depth>=50,"Louver needs at least 50 mm body depth behind the fan");
            for(x=[-louver_screw_x,louver_screw_x],z=[louver_screw_z,module_h-louver_screw_z])
                translate([x,frame_depth-9,z]) rotate([-90,0,0])
                    cylinder(d=2.5,h=9.2,$fn=24);
        }
    }
}
// Open radial guard, aligned to the standard fan screws. The small central
// disk lies in the fan hub's shadow; thin rings and spokes protect the inlet.
// Place on front (negative Y); fasteners pass through guard, flange and fan.
module front_grille() {
    translate([0,0,module_h/2]) rotate([90,0,0])
      linear_extrude(height=2.6)
        difference() {
            union() {
                circle(r=12);
                for(r=[28,43,57])
                    difference() {circle(r=r+1); circle(r=r-1);}
                for(a=[0:18:342])
                    rotate(a) translate([35,0]) square([48,1.8],center=true);
                for(sx=[-1,1],sz=[-1,1])
                    hull() {
                        translate([sx*38,sz*38])circle(d=5,$fn=24);
                        translate([sx*mount_pitch/2,sz*mount_pitch/2])circle(d=11,$fn=24);
                    }
                }
            for(x=[-mount_pitch/2,mount_pitch/2],z=[-mount_pitch/2,mount_pitch/2])
                translate([x,z]) circle(d=4.3,$fn=24);
        }
}
// Left outer closure, joins module's left female channel.
module left_end_cap() {
    difference() {
        union() {
            translate([-cap_w/2,0,0]) cube([cap_w,frame_depth,module_h]);
            tongue(cap_w/2);
            stack_keys(cap_w);
        }
        // Outer edge is closed; the internal wire channel ends at this cap.
        stack_sockets(cap_w);
    }
}
// Right outer closure, joins module's right male tongue.
module right_end_cap() {
    difference() {
        union(){translate([-cap_w/2,0,0]) cube([cap_w,frame_depth,module_h]);stack_keys(cap_w);}
        groove(-cap_w/2);
        stack_sockets(cap_w);
        // Outer edge is closed; no through-hole to the window jamb.
    }
}
// Empty window-width filler has same 140mm pitch; useful for incremental arrays.
module filler(width=filler_w) {
    assert(width >= 22 && width <= 220,"Filler must be 22..220 mm");
    difference() {
        union(){
            translate([-width/2,0,0])cube([width,frame_depth,module_h]);
            tongue(width/2);
            stack_keys(width);
        }
        groove(-width/2);
        stack_sockets(width);
        wire_pass(width);
        // Foam cassette: 4 mm front skin, 8 mm side rims, 9 mm top/bottom rims.
        // Narrow fillers remain solid because a useful foam insert will not fit.
        if(width>=40) {
            translate([-width/2+8,4,9])cube([width-16,frame_depth-3,module_h-18]);
            for(x=[-width/2+4,width/2-4],z=[25,115])
                translate([x,frame_depth-8.1,z])
                    rotate([-90,0,0]) cylinder(d=2.5,h=8.3,$fn=24);
        }
    }
}
module spacer(){filler(module_w);}
// Use a same-width blank above a single bottom-row electronics enclosure.
module controller_blank(){filler(controller_w);}
// Rear skin seals a rigid-foam insert inside a solid, blank, or side panel.
// Four M3 clearance holes align with the pilot holes in the printed rim.
module panel_lid(width=panel_w) {
    assert(width>=40 && width<=220,"Panel lid width must be 40..220 mm");
    difference() {
        translate([-width/2+0.5,0,0.5]) cube([width-1,2.4,module_h-1]);
        for(x=[-width/2+4,width/2-4],z=[25,115])
            translate([x,-0.1,z]) rotate([-90,0,0]) cylinder(d=3.3,h=2.6,$fn=24);
    }
}
// Room-side off-cycle cover. Open rear receives a cut rigid-foam core.
// A separate full back skin is bonded to the shell after inserting the magnets.
module fan_cover(depth=cover_depth) {
    assert(depth>=20 && depth<=80,"Fan cover depth must be 20..80 mm");
    difference() {
        translate([-69,-depth,1]) cube([138,depth-6,138]);
        translate([-61,-depth+3,9]) cube([122,depth-8.8,122]);
    }
}
// Full back skin sits at Y=-6..-3.6. The land leaves the selected gasket gap.
// Magnet pockets open toward the shell so the bonded shell traps each magnet.
module fan_cover_lid() {
    difference() {
        union() {
            translate([-69,0,1]) cube([138,2.4,138]);
            difference() {
                translate([-69,2.4,1]) cube([138,3.6-gasket_thickness,138]);
                translate([-61,2.3,9]) cube([122,3.8-gasket_thickness,122]);
            }
            for(x=[-64,64]) {
                translate([x-1.5,6-gasket_thickness,130]) cube([3,2.7+gasket_thickness,4]);
                translate([x-2.5,7.9,130]) cube([5,0.8,4]);
            }
        }
        for(x=[-64,64])
            translate([x,-0.1,15]) rotate([-90,0,0])
                cylinder(d=magnet_d+2*magnet_clearance,h=5.8-gasket_thickness,$fn=48);
    }
}
// Push behind each magnet before bonding on the cover shell; this keeps its
// face against the pocket floor while the shell mechanically traps both.
module magnet_spacer() {
    cylinder(d=magnet_d+2*magnet_clearance-0.3,
             h=5.8-gasket_thickness-magnet_h-magnet_clearance,$fn=48);
}
// Top edge height adjustment panels, with sockets mating to modules below.
module top_trim(width=module_w,height=trim_h) {
    assert(height>=7 && height<=100,"Trim height must be 7..100 mm");
    difference(){
        union(){translate([-width/2,0,0])cube([width,frame_depth,height]);tongue(width/2,0,height);}
        groove(-width/2,-0.1,height+0.2);
        stack_sockets(width);
    }
}
// Top rail sections follow the same horizontal order as the row below.
// End sections close the outside edges instead of leaving exposed joinery.
module top_rail(width=panel_w,height=trim_h,edge=rail_edge) {
    assert(width>=12 && width<=220,"Top rail width must be 12..220 mm");
    assert(height>=7 && height<=100,"Top rail height must be 7..100 mm");
    assert(sash_slot_w>=6 && sash_slot_w<=50 && frame_depth>=sash_slot_w+29,
           "Body depth must leave front joinery and a 5 mm rear lip around the sash channel");
    assert(sash_engagement>=3 && sash_engagement<=20 && height>=sash_engagement+7,
           "Top rail needs at least 7 mm below the sash channel for rear pin sockets");
    difference() {
        union() {
            translate([-width/2,0,0]) cube([width,frame_depth,height]);
            if(edge!="right") tongue(width/2,0,height);
        }
        if(edge!="left") groove(-width/2,-0.1,height+0.2);
        stack_sockets(width);
        // Continuous top-open U channel receives the lowered window sash.
        // Its front edge clears the dovetail rail at Y=16.
        translate([-width/2-1,frame_depth-sash_slot_w-5,height-sash_engagement])
            cube([width+rail_height+2,sash_slot_w,sash_engagement+0.2]);
    }
}
// Exterior louver. A 116 mm circular outlet avoids choking the 114 mm inlet.
// Five shallow slats shed rain while leaving substantially more frontal area
// than the original deep, closely spaced slats. Corner M3 screws stay outside
// the fan insertion envelope. Keep the outlet facing down.
module output_louver() {
    assert(frame_depth>=50,"Louver needs at least 50 mm body depth behind the fan");
    difference() {
        union() {
            difference() {
                translate([-70,0,0]) cube([140,4,140]);
                translate([0,-0.1,module_h/2]) rotate([-90,0,0])
                    cylinder(d=116,h=4.2,$fn=96);
            }
            intersection() {
                for(z=[26:22:114])
                    hull() {
                        translate([-60,3,z]) cube([120,2,2]);
                        translate([-60,17,z-6]) cube([120,2,2]);
                    }
                translate([0,0,module_h/2]) rotate([-90,0,0])
                    cylinder(d=120,h=20,$fn=96);
                }
        }
        for(x=[-louver_screw_x,louver_screw_x],z=[louver_screw_z,module_h-louver_screw_z])
            translate([x,-0.1,z]) rotate([-90,0,0]) cylinder(d=3.3,h=4.2,$fn=24);
    }
}
// Controller node 80mm wide, same joinery + overall height as fan nodes.
// Recess is open to the exterior/back, panel faces the room.
module controller_node() {
    difference() {
        union() {
            translate([-controller_w/2,0,0])cube([controller_w,frame_depth,module_h]);
            tongue(controller_w/2);
            stack_keys(controller_w);
            // Four PCB mounting bosses project into rear electronics cavity.
            for(x=[-13,13],z=[47,97])
                translate([x,5,z]) rotate([-90,0,0]) cylinder(d=8,h=7);
        }
        groove(-controller_w/2);
        stack_sockets(controller_w);
        // Electronics bay, leaving 5mm front skin and 6mm frame edges.
        translate([-controller_w/2+6,5,8])cube([controller_w-12,frame_depth-4,module_h-16]);
        // Rebuildable bosses are added below as separate solids (see module).
        wire_pass(controller_w);
        // Pilot holes in rear perimeter for four lid screws (2.5-3mm thread-forming).
        for(x=[-36,36],z=[18,122])
            translate([x,frame_depth-7,z])rotate([-90,0,0])cylinder(d=2.6,h=8);
        // Shallow room-side label recess; preserve the front air barrier.
        translate([-12,-1,112])cube([24,4.5,6]);
    }
    // Stand-offs in empty bay, with M2.5 clearance holes.
    for(x=[-13,13],z=[47,97])
        difference() {
            translate([x,5,z])rotate([-90,0,0])cylinder(d=8,h=7);
            translate([x,4,z])rotate([-90,0,0])cylinder(d=2.7,h=9);
        }
}
// Cover on exterior face. Four screws engage the body pilot holes.
module controller_lid() {
    difference() {
        translate([0,frame_depth+1.2,module_h/2]) cube([controller_w-2,2.4,module_h-2],center=true);
        // Solid lid; seal its perimeter with thin closed-cell gasket tape.
        for(x=[-36,36],z=[18,122])
            translate([x,frame_depth-2,z])rotate([-90,0,0])cylinder(d=3.2,h=7);
    }
}
module fan_dummy(){
    %translate([-60,front_flange,10])cube([120,25,120]);
}
module assembly(){
    // Each row has N fans + 80 mm controller column (blank above row 1)
    // + a configurable filler + left/right end caps.
    for(r=[0:row_count-1]) {
        translate([0,0,r*module_h]) {
            translate([-module_w/2-cap_w,0,0])left_end_cap();
            for(i=[0:fan_count-1]) translate([i*module_w,0,0]) {
                fan_housing();
                color("silver") front_grille();
                if(show_louvers) translate([0,frame_depth,0]) color("slategray") output_louver();
                if(show_fan_dummies)fan_dummy();
            }
            translate([fan_count*module_w-module_w/2+controller_w/2,0,0]) {
                if(r==0) {controller_node(); color("slategray") controller_lid();}
                else {controller_blank(); translate([0,frame_depth,0]) color("tan") panel_lid(controller_w);}
            }
            translate([fan_count*module_w-module_w/2+controller_w+filler_w/2,0,0]) {
                filler(filler_w);
                if(filler_w>=40) translate([0,frame_depth,0]) color("tan") panel_lid(filler_w);
            }
            translate([fan_count*module_w-module_w/2+controller_w+filler_w+cap_w/2,0,0])right_end_cap();
        }
    }
}
if(part=="fan")fan_housing();
else if(part=="grill")front_grille();
else if(part=="left_cap")left_end_cap();
else if(part=="right_cap")right_end_cap();
else if(part=="controller")controller_node();
else if(part=="controller_lid")controller_lid();
else if(part=="spacer")spacer();
else if(part=="filler")filler(filler_w);
else if(part=="controller_blank")controller_blank();
else if(part=="panel_lid")panel_lid(panel_w);
else if(part=="fan_cover")fan_cover(cover_depth);
else if(part=="fan_cover_lid")fan_cover_lid();
else if(part=="magnet_spacer")magnet_spacer();
else if(part=="trim_fan")top_trim(module_w,trim_h);
else if(part=="trim_controller")top_trim(controller_w,trim_h);
else if(part=="trim_filler")top_trim(filler_w,trim_h);
else if(part=="trim_cap")top_trim(cap_w,trim_h);
else if(part=="top_rail")top_rail(panel_w,trim_h,rail_edge);
else if(part=="louver")output_louver();
else if(part=="test_dovetail_male")test_dovetail_male();
else if(part=="test_dovetail_female")test_dovetail_female();
else if(part=="test_pin_male")test_pin_male();
else if(part=="test_pin_female")test_pin_female();
else assembly();
