/**
 * 
 * @param {foundry.documents.User} _user - The existing User document which was updated
 * @param {object} changed - Differential data that was used to update the document
 * @param {Partial<foundry.abstract.types.DatabaseUpdateOperation>} _options - Additional options which modified the update request
 * @param {String} _userId - The ID of the User who triggered the update workflow
 */
export default function onUpdateUser(_user, changed, _options, _userId) {
  if ( ["active", "character"].some(k => k in changed) ) {
      ui.actors.minaxamasToolbox.render();
    }
}