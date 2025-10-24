# dash-ts

A TypeScript library providing comprehensive methods and type definitions for parsing and working with Dynamic Adaptive Streaming over HTTP (DASH) manifests.

## Overview

**dash-ts** is a robust TypeScript library designed to parse and manipulate DASH (Dynamic Adaptive Streaming over HTTP) manifest files (MPD - Media Presentation Description). It provides full type safety and comprehensive support for the DASH specification, including support for various segment types, content protection schemes, and adaptive streaming features.

## Features

- **Basic DASH Specification Support**: Parse complete DASH manifests with all standard elements and attributes
- **Type-Safe**: Comprehensive TypeScript type definitions for all DASH elements
- **Content Protection**: Built-in support for PlayReady and Widevine DRM schemes
- **Segment Types**: Support for SegmentBase, SegmentList, and SegmentTemplate
- **Adaptive Streaming**: Full support for periods, adaptation sets, and representations
- **Duration Parsing**: Automatic conversion of ISO 8601 durations to seconds
- **Event Streams**: Support for event streams including SCTE-35 signals
- **Production Ready**: Tested against DASH-IF test vectors

## Installation

```bash
pnpm add dash-ts
```

Or with npm:

```bash
npm install dash-ts
```

Or with yarn:

```bash
yarn add dash-ts
```

## Quick Start

```typescript
import { getRawDashManifest } from 'dash-ts';

// Parse a DASH manifest from a string
const manifestXml = `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" ...>
  <!-- manifest content -->
</MPD>`;

const manifest = await getRawDashManifest(manifestXml);

// Access manifest properties
console.log(manifest.type); // 'static' or 'dynamic'
console.log(manifest.periods); // Array of periods
console.log(manifest.minBufferTime); // Minimum buffer time in seconds
```

## API Reference

### `getRawDashManifest(manifest: string): Promise<MPD>`

Parses a DASH manifest XML string and returns a structured `MPD` object.

**Parameters:**
- `manifest` (string): The DASH manifest XML content

**Returns:** Promise resolving to an `MPD` object containing the parsed manifest

**Example:**
```typescript
const mpd = await getRawDashManifest(manifestXml);
```

## Type Definitions

### Core Types

#### `MPD`
The root Media Presentation Description object containing:
- `type`: 'static' or 'dynamic'
- `profiles`: Profile string
- `periods`: Array of Period objects
- `minBufferTime`: Minimum buffer time in seconds
- `mediaPresentationDuration`: Total duration in seconds (optional)
- `availabilityStartTime`: Start time for dynamic streams (optional)
- `contentProtection`: Array of content protection descriptors (optional)

#### `Period`
Represents a time period in the manifest:
- `id`: Period identifier (optional)
- `duration`: Duration in seconds (optional)
- `adaptationSet`: Array of AdaptationSet objects
- `baseUrl`: Array of base URLs (optional)
- `contentProtection`: Content protection info (optional)

#### `AdaptationSet`
Groups representations with similar characteristics:
- `id`: Adaptation set identifier (optional)
- `contentType`: 'video' | 'audio' | 'image' | 'text' | 'application' | 'font'
- `representation`: Array of Representation objects
- `segmentTemplate`: Segment template definition (optional)
- `segmentList`: Segment list definition (optional)
- `segmentBase`: Segment base definition (optional)

#### `Representation`
Individual media stream with specific codec and bitrate:
- `id`: Representation identifier
- `bandwidth`: Bitrate in bits per second
- `mimeType`: MIME type (optional)
- `codecs`: Codec string (optional)
- `width`: Video width in pixels (optional)
- `height`: Video height in pixels (optional)
- `frameRate`: Frame rate (optional)

#### `ContentProtection`
DRM/encryption information:
- `schemeIdUri`: Protection scheme identifier
- `playready`: PlayReady-specific info (optional)
- `widevine`: Widevine-specific info (optional)

### Segment Types

#### `SegmentTemplate`
Template-based segment definition:
- `media`: Media segment URL template
- `index`: Index segment URL template (optional)
- `initialization`: Initialization segment URL (optional)
- `duration`: Segment duration
- `timescale`: Timescale for duration

#### `SegmentList`
Explicit list of segments:
- `segmentUrl`: Array of segment URLs
- `duration`: Segment duration
- `timescale`: Timescale for duration

#### `SegmentBase`
Base segment information:
- `timescale`: Timescale for timing information
- `indexRange`: Byte range for index (optional)
- `initializationElement`: Initialization segment info (optional)

## Examples

### Parsing a Static Manifest

```typescript
import { getRawDashManifest } from 'dash-ts';

const manifestXml = await fetch('stream.mpd').then(r => r.text());
const mpd = await getRawDashManifest(manifestXml);

// Access periods
mpd.periods.forEach(period => {
  console.log(`Period: ${period.id}`);

  // Access adaptation sets
  period.adaptationSet?.forEach(adaptationSet => {
    console.log(`  Content Type: ${adaptationSet.contentType}`);

    // Access representations
    adaptationSet.representation?.forEach(rep => {
      console.log(`    Representation: ${rep.id} (${rep.bandwidth} bps)`);
    });
  });
});
```

### Working with Content Protection

```typescript
const mpd = await getRawDashManifest(manifestXml);

// Check for DRM protection
mpd.contentProtection?.forEach(protection => {
  if (protection.playready) {
    console.log('PlayReady protected');
    console.log('PSSH:', protection.playready.cencPssh);
  }

  if (protection.widevine) {
    console.log('Widevine protected');
    console.log('PSSH:', protection.widevine.cencPssh);
  }
});
```

### Accessing Segment Information

```typescript
const mpd = await getRawDashManifest(manifestXml);

mpd.periods.forEach(period => {
  period.adaptationSet?.forEach(adaptationSet => {
    adaptationSet.representation?.forEach(rep => {
      if (rep.segmentTemplate) {
        console.log('Media template:', rep.segmentTemplate.media);
        console.log('Initialization:', rep.segmentTemplate.initialization);
        console.log('Duration:', rep.segmentTemplate.duration);
        console.log('Timescale:', rep.segmentTemplate.timescale);
      }
    });
  });
});
```

## Testing

The library includes comprehensive tests using Vitest and is validated against DASH-IF test vectors.

Run tests:
```bash
pnpm test
```

Run linting:
```bash
pnpm lint
```

Run type checking:
```bash
pnpm typecheck
```

## Build

Build the library:
```bash
pnpm build
```

This generates:
- `dist/index.mjs` - ES module
- `dist/index.cjs` - CommonJS module
- `dist/index.d.ts` - TypeScript definitions

## Dependencies

- **xml2js**: XML parsing
- **iso8601-duration**: ISO 8601 duration parsing
- **axios**: HTTP client (for testing)
- **@fast-csv/parse**: CSV parsing (for testing)

## Browser Support

dash-ts works in both Node.js and browser environments. The library exports both ESM and CommonJS formats for maximum compatibility.

## Contributing

Contributions are welcome! Please ensure:
- Code passes linting: `pnpm lint`
- Types are correct: `pnpm typecheck`
- Tests pass: `pnpm test`
