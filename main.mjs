import * as applications from "./module/applications/_module.mjs";
import * as hooks from "./module/hooks/_module.mjs";
import { MODULE_NAMESPACE } from "./module/constants.mjs";
import {moduleToObject} from "./module/utils.mjs";

globalThis[MODULE_NAMESPACE] = {
  applications: moduleToObject(applications),
}

Hooks.on("renderActorDirectory", hooks.onRenderActorDirectory);
Hooks.on("updateUser", hooks.onUpdateUser);
Hooks.on("userConnected", hooks.onUserConnected);
