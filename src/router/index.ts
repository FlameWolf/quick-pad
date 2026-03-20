import { createRouter, createWebHistory } from "vue-router";
import DisplayNoteList from "@/components/DisplayNoteList.vue";
import DisplayNote from "@/components/DisplayNote.vue";

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{ path: "/notes", component: DisplayNoteList },
		{ path: "/notes/:id", component: DisplayNote, props: true }
	]
});

export default router;