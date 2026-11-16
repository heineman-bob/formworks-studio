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
trim_h = 12;
panel_w = 140;
rail_edge = "middle"; // middle, left, right
vertical_keys = true;
show_fan_dummies = true;

module_w = 140;
module_h = 140;
frame_depth = 32;
fan_size = 120;
fan_thickness = 25;
fan_clearance = 0.7;
mount_pitch = 105;
mount_hole_d = 4.3;
front_flange = 4.5;
fit = 0.30;           // dovetail fit radial clearance, adjust for printer
rail_height = 7.0;   // protrusion in X
rail_root_half = 3.1;
rail_head_half = 5.4;
rail_y = 16;
wire_d = 6.0;
wire_y = 23;
wire_z = 5.2;
controller_w = 80;
cap_w = 12;

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
      polygon([[sideX-0.4,rail_y-rail_root_half-fit],
               [sideX+rail_height+fit,rail_y-rail_head_half-fit],
               [sideX+rail_height+fit,rail_y+rail_head_half+fit],
               [sideX-0.4,rail_y+rail_root_half+fit]]);
}
module wire_pass(width) {
    translate([-width/2-rail_height-1,wire_y,wire_z])
      rotate([0,90,0]) cylinder(d=wire_d,h=width+2*rail_height+2);
}
module circular_airway() {
    translate([0,-2,module_h/2])
      rotate([-90,0,0]) cylinder(d=114,h=front_flange+4);
}
module fastener_holes() {
    for(x=[-mount_pitch/2,mount_pitch/2], z=[module_h/2-mount_pitch/2,module_h/2+mount_pitch/2])
      translate([x,-2,z]) rotate([-90,0,0]) cylinder(d=mount_hole_d,h=front_flange+5);
}
// Registration studs align stacked rows; lateral dovetails align neighboring columns.
// Studs can be removed with vertical_keys=false for flush-top prints.
module stack_keys(w, height=module_h) {
    if(vertical_keys) for(x=(w < 40 ? [0] : [-min(40,w/2-10),min(40,w/2-10)]))
        translate([x,3.5,height]) cylinder(d=4.8,h=5.5,$fn=24);
}
module stack_sockets(w) {
    if(vertical_keys) for(x=(w < 40 ? [0] : [-min(40,w/2-10),min(40,w/2-10)]))
        translate([x,3.5,-0.1]) cylinder(d=5.4,h=6.1,$fn=24);
}
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
    }
}
// Removable low-profile front grille, aligned to the standard fan screws.
// Place on front (negative Y); fasteners pass through grille, flange and fan.
module front_grille() {
    difference() {
        union() {
            for(r=[17,36,54])
                difference() {
                    translate([0,-2.6,module_h/2]) rotate([-90,0,0]) cylinder(r=r+2,h=2.6);
                    translate([0,-3,module_h/2]) rotate([-90,0,0]) cylinder(r=r-2,h=3.4);
                }
            for(a=[0:45:315])
                rotate([0,0,0])
                translate([0,-1.3,module_h/2])
                rotate([0,a,0]) cube([108,2.6,3.8],center=true);
            for(sx=[-1,1],sz=[-1,1]) {
                hull() {
                    translate([sx*37,-2.6,module_h/2+sz*37])rotate([-90,0,0])cylinder(d=7,h=2.6);
                    translate([sx*mount_pitch/2,-2.6,module_h/2+sz*mount_pitch/2])rotate([-90,0,0])cylinder(d=13,h=2.6);
                }
            }
        }
        for(x=[-mount_pitch/2,mount_pitch/2],z=[module_h/2-mount_pitch/2,module_h/2+mount_pitch/2])
            translate([x,-3,z]) rotate([-90,0,0]) cylinder(d=4.3,h=4);
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
        wire_pass(cap_w);
        stack_sockets(cap_w);
    }
}
// Right outer closure, joins module's right male tongue.
module right_end_cap() {
    difference() {
        union(){translate([-cap_w/2,0,0]) cube([cap_w,frame_depth,module_h]);stack_keys(cap_w);}
        groove(-cap_w/2);
        stack_sockets(cap_w);
        wire_pass(cap_w);
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
        // Material-saving pocket open towards outside; preserve full face.
        translate([-width/2+8,4,9])cube([width-16,frame_depth-3,module_h-18]);
    }
}
module spacer(){filler(module_w);}
// Use a same-width blank above a single bottom-row electronics enclosure.
module controller_blank(){filler(controller_w);}
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
    difference() {
        union() {
            translate([-width/2,0,0]) cube([width,frame_depth,height]);
            if(edge!="right") tongue(width/2,0,height);
        }
        if(edge!="left") groove(-width/2,-0.1,height+0.2);
        stack_sockets(width);
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
        // Indicator/window; room-facing side (optional label or LED mount).
        translate([-12,-1,112])cube([24,8,6]);
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
        // Passive ventilation slots; avoid if unit faces rain.
        for(z=[30:9:111]) translate([-24,frame_depth-2,z])cube([48,8,3]);
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
                if(show_fan_dummies)fan_dummy();
            }
            translate([fan_count*module_w-module_w/2+controller_w/2,0,0]) {
                if(r==0)controller_node(); else controller_blank();
            }
            translate([fan_count*module_w-module_w/2+controller_w+filler_w/2,0,0]) filler(filler_w);
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
else if(part=="trim_fan")top_trim(module_w,trim_h);
else if(part=="trim_controller")top_trim(controller_w,trim_h);
else if(part=="trim_filler")top_trim(filler_w,trim_h);
else if(part=="trim_cap")top_trim(cap_w,trim_h);
else if(part=="top_rail")top_rail(panel_w,trim_h,rail_edge);
else assembly();
