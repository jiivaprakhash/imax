# Cinema Simulator

A first-person 3D cinema. Walk around a 144-seat auditorium, sit in any seat,
watch a looping video on the big screen, and compare the picture and the
simulated surround sound from different seats.

Built with React, Vite, Three.js, React Three Fiber, Drei, React Three Rapier
(collisions), post-processing and the Web Audio API.

## Run it

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173) and press **Enter cinema**.

## Add your video

Copy your film to:

```
public/videos/cinema-loop.mp4
```

Use H.264 video with AAC audio in an `.mp4` file (works in every browser),
ideally 16:9. It loops forever. Replace the file any time; no code changes needed.

If the file is missing, the app shows a demo screen with a generated test
soundtrack (kick, hi-hats, and a melody that sweeps left to right), so you can
still try everything, including the spatial audio.

## Controls

| Key | Action |
| --- | --- |
| W A S D (or arrows) | Walk |
| Mouse | Look around |
| Shift | Walk faster |
| E | Sit in the seat you are next to / stand up |
| P | Play / pause (house lights come up when paused) |
| M | Mute |
| I | Show / hide the seat details panel |
| Esc | Free the mouse to click buttons (click the view to resume) |

You can also click any seat on the map in the side panel, use the quick
buttons (front row, middle, back, corners), or pick a row and seat number.
Use **Save to compare** to build a small table of up to three seats.

## What the numbers mean

For the seat you are sitting in, the panel shows (all computed from that
seat's 3D position, see `src/seatCalculations.js`):

- **Distance to screen**: straight line from your eyes to the screen centre.
- **Angle to screen centre**: how far off the centre line you are.
- **Screen fills**: horizontal and vertical field of view the screen occupies.
- **Head tilt up**: how far you look up to see the top edge.
- **View comfort (0-100)**: weighted from the three factors above. It follows
  common cinema guidance: the screen should fill roughly 30-50 degrees
  horizontally (SMPTE about 30, THX about 36-40), sitting far off-centre skews
  the picture, and tilting your head up more than ~30 degrees tires the neck.
- **Sound (0-100)**: front-stage balance, centre-speaker angle (dialogue),
  how much of the sound comes from surround speakers, and left/right surround balance.

> **Important:** the audio ratings are *estimates*. They use speaker distance,
> speaker direction and a simple open-air level model. They do not include room
> reflections, absorption, reverberation or real speaker frequency response, so
> they are not acoustic measurements unless you calibrate them with real ones.

## How the spatial audio works

`src/SpatialAudio.js` builds this graph:

```
video -> stereo -> split L/R -> per speaker: mix -> level -> delay -> PannerNode -> master -> compressor -> output
```

- 10 virtual speakers (3 front, 4 side, 2 rear, 1 subwoofer) at the positions
  in `src/cinemaLayout.js`, aimed at the audience.
- Each `PannerNode` places its speaker in 3D with distance falloff and a
  directional cone. The Web Audio **listener** is your camera, so sound
  changes as you walk, sit and turn your head.
- `DelayNode`s add the extra travel time of far speakers, relative to the
  nearest one, so picture and sound stay in sync.
- A normal stereo video is upmixed: side and rear speakers receive mixes
  of left/right (including the left-minus-right ambience), the centre gets the
  sum, and the subwoofer gets low frequencies. A true 5.1 soundtrack is
  downmixed to stereo first.
- The video's own audio is routed through Web Audio (the `<video>` element is
  never muted directly). The mute button and volume slider control the master gain.
- Settings let you switch to plain stereo to hear the difference. Use headphones
  for the strongest effect (HRTF panning is designed for them).

## Autoplay rules

Browsers only allow sound and mouse capture after a click. Pressing
**Enter cinema** starts the audio engine, the video and mouse look in one go.
If a browser still blocks playback, a "Click to start" button appears.

## Project layout

```
src/
  App.jsx                  Canvas + UI, keyboard shortcuts, audio settings
  store.js                 Shared state (zustand)
  cinemaLayout.js          Room, screen, seats and speaker positions (edit here!)
  seatCalculations.js      Distance, angles, comfort, speaker level estimates
  SpatialAudio.js          Web Audio surround engine + demo soundtrack
  videoSource.js           The <video> element and the demo screen
  playback.js              Play / pause and autoplay handling
  bridge.js                Lets HTML buttons capture the mouse
  components/              3D scene
    Cinema.jsx             Room, platforms, walls, ceiling, collision walls
    CinemaScreen.jsx       Video texture on the screen + colour sampling
    Lighting.jsx           Movie / house lights, screen glow, shadows
    Speakers.jsx           Speaker models with live level glow
    SeatRows.jsx, Seat.jsx Seats and their colliders
    Player.jsx             Walking, physics body, sitting / standing
  ui/                      HTML interface
    WelcomeScreen.jsx, HUD.jsx, ExperiencePanel.jsx,
    MiniMap.jsx, SettingsPanel.jsx
```

## Customising

- **Change the room**: edit `src/cinemaLayout.js` (rows, seats per row, screen
  size, speaker positions). Seats, colliders, calculations, the map and the
  audio all update from it.
- **Change brightness**: intensities are in `src/components/Lighting.jsx`.
- **Performance**: open Settings and choose **Low** (no shadows, no glow, lower
  resolution). 144 seats are drawn individually, which is fine on most desktops.

## How walking works

Movement uses a Rapier capsule body, so walls, the stage and seats block you.
The floor is stepped (each row is 0.28 m higher), and instead of fighting the
physics engine over stair edges, the player glides to the floor height found
under it each frame. That keeps stair climbing smooth.

## Notes

- Tested logic: the seat maths run in plain Node, and every file bundles cleanly.
  The 3D scene itself was written without a browser available, so if
  something looks too dark or too bright on your screen, adjust the numbers in
  `Lighting.jsx` first.
- Fonts load from Google Fonts. Offline, the interface falls back to system fonts.
