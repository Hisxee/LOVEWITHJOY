const MAX_SCENE_WINDOWS = 2

class WindowManager 
{
	#windows;
	#count;
	#id;
	#winData;
	#observerMode = false;
	#winShapeChangeCallback;
	#winChangeCallback;
	#metaDataChangeCallback;
	
	constructor ()
	{
		let that = this;

		// event listener for when localStorage is changed from another window
		addEventListener("storage", (event) => 
		{
			if (event.key == "windows")
			{
				let newWindows = JSON.parse(event.newValue || "[]");
				let winChange = that.#didWindowsChange(that.#windows, newWindows);
				let metaChanges = that.#diffMetaData(that.#windows, newWindows);

				that.#windows = newWindows;
				that.#trimWindows();
				that.#syncCurrentWindowData();

				if (that.#metaDataChangeCallback) {
					for (let i = 0; i < metaChanges.length; i++) {
						that.#metaDataChangeCallback(metaChanges[i]);
					}
				}

				if (winChange)
				{
					if (that.#winChangeCallback) that.#winChangeCallback();
				}
			}
		});

		// event listener for when current window is about to ble closed
		window.addEventListener('beforeunload', function (e) 
		{
			if (that.#observerMode) return;

			let index = that.getWindowIndexFromId(that.#id);

			//remove this window from the list and update local storage
			if (index >= 0) {
				that.#windows.splice(index, 1);
				that.updateWindowsLocalStorage();
			}
		});
	}

	// check if theres any changes to the window list
	#didWindowsChange (pWins, nWins)
	{
		if (pWins.length != nWins.length)
		{
			return true;
		}
		else
		{
			let c = false;

			for (let i = 0; i < pWins.length; i++)
			{
				if (pWins[i].id != nWins[i].id) c = true;
			}

			return c;
		}
	}

	// initiate current window (add metadata for custom data to store with each window instance)
	#trimWindows ()
	{
		if (this.#windows.length > MAX_SCENE_WINDOWS) {
			this.#windows = this.#windows.slice(0, MAX_SCENE_WINDOWS);
		}
	}

	#diffMetaData (prev, next)
	{
		const changes = [];
		for (let a = 0; a < next.length; a++) {
			const nw = next[a];
			for (let b = 0; b < prev.length; b++) {
				const pw = prev[b];
				if (nw.id != pw.id) continue;
				for (const [key, value] of Object.entries(nw.metaData || {})) {
					const oldVal = pw.metaData?.[key];
					if (oldVal == null) {
						changes.push({ id: nw.id, key, value, newlyAdded: true });
					} else if (JSON.stringify(oldVal) !== JSON.stringify(value)) {
						changes.push({ id: nw.id, key, value, newlyAdded: false });
					}
				}
			}
		}
		return changes;
	}

	#syncCurrentWindowData ()
	{
		if (!this.#id || this.#observerMode) return;

		const found = this.#windows.find((w) => w.id == this.#id);
		if (found) {
			this.#winData = found;
			return;
		}

		if (this.#winData && this.#windows.length < MAX_SCENE_WINDOWS) {
			this.#windows.push(this.#winData);
			this.updateWindowsLocalStorage();
		}
	}

	init (metaData)
	{
		this.#windows = JSON.parse(localStorage.getItem("windows") || "[]");
		this.#trimWindows();
		this.#count = Number(localStorage.getItem("count") || 0);
		this.#count++;

		this.#id = this.#count;

		const alreadyRegistered = this.#windows.some((w) => w.id == this.#id);

		// 已有两个图案窗口时，第三个及之后的页面只观看、不新增
		if (this.#windows.length >= MAX_SCENE_WINDOWS && !alreadyRegistered) {
			this.#observerMode = true;
			this.#winData = null;
			return;
		}

		let shape = this.getWinShape();
		const peers = this.#windows.filter(
			(w) => w.metaData && w.metaData.resolvedIteration === metaData.resolvedIteration
		);
		metaData.instanceIndex = peers.length >= 1 ? 1 : 0;
		this.#winData = { id: this.#id, shape: shape, metaData: metaData };

		const index = this.getWindowIndexFromId(this.#id);
		if (index >= 0) {
			this.#windows[index] = this.#winData;
		} else {
			this.#windows.push(this.#winData);
			this.#trimWindows();
		}

		localStorage.setItem("count", this.#count);
		this.updateWindowsLocalStorage();
	}

	getWinShape ()
	{
		// 与 entangled-bundle 的 qt() 一致，使用 screenX/Y（勿用 screenLeft/Top，否则图案会偏）
		const x = typeof window.screenX === 'number' ? window.screenX : window.screenLeft
		const y = typeof window.screenY === 'number' ? window.screenY : window.screenTop
		return { x, y, w: window.innerWidth, h: window.innerHeight }
	}

	getWindowIndexFromId (id)
	{
		let index = -1;

		for (let i = 0; i < this.#windows.length; i++)
		{
			if (this.#windows[i].id == id) index = i;
		}

		return index;
	}

	updateWindowsLocalStorage ()
	{
		this.#trimWindows();
		localStorage.setItem("windows", JSON.stringify(this.#windows));
	}

	update ()
	{
		if (!this.#winData) return;

		let winShape = this.getWinShape();
		const current = this.#winData.shape;

		if (
			winShape.x != current.x ||
			winShape.y != current.y ||
			winShape.w != current.w ||
			winShape.h != current.h
		) {
			this.#winData.shape = winShape;

			let index = this.getWindowIndexFromId(this.#id);
			if (index < 0) {
				this.#windows.push(this.#winData);
				index = this.#windows.length - 1;
			} else {
				this.#windows[index].shape = winShape;
			}

			if (this.#winShapeChangeCallback) this.#winShapeChangeCallback();
			this.updateWindowsLocalStorage();
		}
	}

	setWinShapeChangeCallback (callback)
	{
		this.#winShapeChangeCallback = callback;
	}

	setWinChangeCallback (callback)
	{
		this.#winChangeCallback = callback;
	}

	setMetaDataChangeCallback (callback)
	{
		this.#metaDataChangeCallback = callback;
	}

	setMetaData (key, value)
	{
		if (!this.#winData) return false;
		if (this.#winData.metaData[key] === value) return false;
		this.#winData.metaData[key] = value;
		const index = this.getWindowIndexFromId(this.#id);
		if (index >= 0) this.#windows[index].metaData = this.#winData.metaData;
		this.updateWindowsLocalStorage();
		return true;
	}

	numWindows ()
	{
		return this.#windows.length;
	}

	getWindows ()
	{
		return this.#windows.slice(0, MAX_SCENE_WINDOWS);
	}

	isObserverMode ()
	{
		return this.#observerMode;
	}

	getThisWindowData ()
	{
		return this.#winData;
	}

	getThisWindowID ()
	{
		return this.#id;
	}
}

export default WindowManager;