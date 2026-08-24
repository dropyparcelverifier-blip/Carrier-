/** The session is read from the signed cookie in hooks.server.js and passed
 *  down here, so the browser never holds credentials of any kind. */
export async function load({ locals }) {
    return { user: locals.user };
}
