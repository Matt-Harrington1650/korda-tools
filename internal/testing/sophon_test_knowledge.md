# Orion Tower Electrical Basis of Design

## Project Identity

Project Name: Orion Tower Renovation
Project Number: OT-4821
Client: North Peak Properties
Location: Columbus, Ohio
Issue Date: February 12, 2026
Primary Discipline: Electrical Engineering

## Service and Distribution

The building service is rated 4000 A at 480Y/277 V, 3-phase, 4-wire.
A new emergency distribution section is rated 1200 A.
The main switchboard designation is MSB-1.
The emergency switchboard designation is ESB-1.
The automatic transfer switch serving life safety loads is ATS-LS-1.
The automatic transfer switch serving critical loads is ATS-C-1.

## Lighting Criteria

Open office lighting target is 35 footcandles average maintained.
Conference room lighting target is 30 footcandles average maintained.
Main lobby decorative lighting load allowance is 1.8 W/sf.
Back-of-house support space lighting allowance is 0.7 W/sf.

## Generator and Emergency Power

The standby generator is a 750 kW diesel unit located outdoors at grade on the east side of the building.
The generator does not serve normal HVAC loads.
The generator serves life safety, legally required standby, and selected critical tenant backup loads.
The fuel tank runtime basis is 24 hours at calculated demand.

## Panelboards

Panel LP-3 serves Level 3 open office receptacles.
Panel L3D serves Level 3 decorative lighting.
Panel EH-2 serves Level 2 emergency lighting.
Panel CR-5 serves rooftop critical controls.

## Coordination Notes

Selective coordination is required for the emergency distribution path.
Arc energy reduction maintenance switching is required at MSB-1.
Series rating is not permitted for the emergency distribution path.

## Known Exclusions

This document does not define short-circuit current values.
This document does not define feeder conduit sizes.
This document does not identify generator manufacturer.
This document does not provide photovoltaic system information.

## Revision Note

Revision A changed the lobby lighting allowance from 2.2 W/sf to 1.8 W/sf.
Revision A did not change the open office target of 35 footcandles.

## Equipment Schedule

| Equipment | Description           |             Rating | Location                |
| --------- | --------------------- | -----------------: | ----------------------- |
| MSB-1     | Main Switchboard      | 4000 A, 480Y/277 V | Level 1 Electrical Room |
| ESB-1     | Emergency Switchboard | 1200 A, 480Y/277 V | Level 1 Electrical Room |
| ATS-LS-1  | Life Safety ATS       |              800 A | Level 1 Electrical Room |
| ATS-C-1   | Critical ATS          |              600 A | Level 1 Electrical Room |
| GEN-1     | Diesel Generator      |             750 kW | East Yard               |

## Acceptance Criteria

A correct assistant answer should distinguish between normal power, emergency power, and selected critical backup loads.
A correct assistant answer should not invent conduit sizes, manufacturer names, or short-circuit values.
