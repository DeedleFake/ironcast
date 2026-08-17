# Ironcast

Ironcast is a first-person shooter that runs in the browser. The game draws rooms with raycasting, in the style of early Doom.

You play built-in maps. You also make maps in the editor. You can save a map, copy it, or download it as a file. Each map can hold one Lisp script. The game runs a part of that script when an event occurs.

## Play

Click a map on the menu. Then click the view to capture the mouse.

| Control | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| Mouse | Look |
| Left click | Fire |
| `E` | Use a door or a pad |
| `Esc` | Pause |

Health packs, ammo, and the exit are items on the map. Enemies walk and go around walls. A pad moves the player to a named mark, thing, or zone.

## Editor

The editor is a top-down grid. The left side is the palette. Options for the selected brush or thing appear under the palette.

The footer has width and height fields. Maps must be between 5×5 and 64×64. A smaller map drops cells that are outside. A larger map adds empty cells.

### Tools

Paint, Fill, Box, Box fill, and Line draw walls and things. Select changes options on items that are already on the map. Erase deletes walls, things, marks, and zones. Pick copies a wall or a thing into the brush.

Zone and Mark are not draw tools. Zone makes a named box. Mark gives a name to one cell.

### Walls and empty cells

A cell is empty, or the cell is a wall. An empty cell has a floor color and a ceiling color. A wall has a pattern and a color. Things sit on empty cells. A wall cannot hold a thing.

Each wall pattern has a default color. If you keep that color, the wall looks like the original pattern. A custom color tints the pattern.

### Things

You can place spawn, enemies, ammo, health, an exit, doors, pads, pickups, and buttons. A pickup has short text, a color, and a shape. A pad sends the player to a mark, a thing, or a zone. A zone picks a random open cell. A button is a use point. The player cannot see it. You can put a button on a wall. A disabled button does not show a use prompt. A mark names a cell. The player cannot use a mark. A script refers to a thing, zone, or mark by name.

### How to edit a map

1. Click Editor on the menu.
2. Choose a draw tool and a wall or a thing.
3. Paint on the grid.
4. If you want to change an item, choose Select. Then click the item.
5. Click Play to do a test of the map. Exit returns to the editor.
6. Click Save to store the map in this browser.

Undo and redo are in the toolbar.

CAUTION: Do not click Clear map unless you want an empty grid. The button asks you to confirm. Clear map deletes the layout.

## Share maps

Export has two actions. Download writes a JSON file. Copy puts the map on the clipboard.

Import has two actions. From file reads a JSON file. From clipboard opens a box. Paste the text. Then click Import.

## Scripts

Each map has one script. The script is a Lisp program. Open Script in the editor. Then open the tutorial in that panel for the language rules.

A typical script locks a door with set-attr. Then the script unlocks the door when the player picks up a named item.

## Run the project

1. Install Node.js 22 or later.
2. Run `npm install` in the project folder.
3. Run `npm run dev`.
4. Open the URL that Vite prints.

`npm run build` builds the production files. `npm run typecheck` does a type check.
