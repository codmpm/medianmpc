/**
 * MPC Track File Builder
 * Creates empty .xtm track files whose track and program carry a given name.
 *
 * The MPC ignores note events when it loads a .xtm, but uses the track name as
 * the default name when the track is saved as an arp pattern. Loading a
 * same-named .xtm before loading the .mpcpattern therefore saves typing the
 * pattern name on the device.
 */

import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import templateUrl from './templates/track-template.xtm';

// Name of the track and program in the template, saved by MPC 3.9.1.2
const TEMPLATE_NAME = 'MPC_ARP_Default';
const TEMPLATE_NAME_FIELD = `"name": ${JSON.stringify(TEMPLATE_NAME)}`;
const TEMPLATE_NAME_COUNT = 2;

let templatePromise = null;

/**
 * Load and unpack the template once. The template is edited as text, because
 * a JSON round trip would turn values like 1.0 into 1 and round the pattern
 * length 9223372036854775807.
 */
export function loadXtmTemplate() {
    if (!templatePromise) {
        templatePromise = fetch(templateUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Could not load .xtm template (HTTP ${response.status})`);
                }
                return response.arrayBuffer();
            })
            .then(buffer => {
                const text = strFromU8(gunzipSync(new Uint8Array(buffer)));
                if (text.split(TEMPLATE_NAME_FIELD).length - 1 !== TEMPLATE_NAME_COUNT) {
                    throw new Error('Unexpected .xtm template content');
                }
                return text;
            })
            .catch(error => {
                // Allow a retry on the next export
                templatePromise = null;
                throw error;
            });
    }
    return templatePromise;
}

/**
 * Build a gzipped .xtm whose track and program are called `name`
 */
export function buildXtm(templateText, name) {
    const text = templateText
        .split(TEMPLATE_NAME_FIELD)
        .join(`"name": ${JSON.stringify(name)}`);
    return gzipSync(strToU8(text), { mtime: 0 });
}
