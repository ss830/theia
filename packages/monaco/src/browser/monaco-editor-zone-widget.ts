/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { Disposable, DisposableCollection, Event, Emitter } from '@theia/core';

export interface MonacoEditorViewZone extends monaco.editor.IViewZone {
    id: number
}

export class MonacoEditorZoneWidget implements Disposable {

    readonly zoneNode = document.createElement('div');
    readonly containerNode = document.createElement('div');

    protected readonly onDidLayoutChangeEmitter = new Emitter<monaco.editor.IDimension>();
    readonly onDidLayoutChange: Event<monaco.editor.IDimension> = this.onDidLayoutChangeEmitter.event;

    protected viewZone: MonacoEditorViewZone | undefined;

    protected readonly toHide = new DisposableCollection();

    protected readonly toDispose = new DisposableCollection(
        this.onDidLayoutChangeEmitter,
        this.toHide
    );

    constructor(
        readonly editor: monaco.editor.IStandaloneCodeEditor
    ) {
        this.zoneNode.classList.add('zone-widget');
        this.containerNode.classList.add('zone-widget-container');
        this.zoneNode.appendChild(this.containerNode);
        this.updateWidth();
        this.toDispose.push(this.editor.onDidLayoutChange(info => this.updateWidth(info)));
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    get options(): Pick<monaco.editor.IViewZone, 'afterLineNumber' | 'afterColumn'> | undefined {
        return this.viewZone;
    }

    hide(): void {
        this.toHide.dispose();
    }

    // TODO: show frame option
    show({ afterLineNumber, afterColumn, heightInLines }: {
        afterLineNumber: number,
        afterColumn?: number,
        heightInLines: number
    }): void {
        const lineHeight = this.editor.getConfiguration().lineHeight;
        const maxHeightInLines = (this.editor.getLayoutInfo().height / lineHeight) * .8;
        if (heightInLines >= maxHeightInLines) {
            heightInLines = maxHeightInLines;
        }
        this.toHide.dispose();
        this.editor.changeViewZones(accessor => {
            this.zoneNode.style.top = '-1000px';
            const domNode = document.createElement('div');
            domNode.style.overflow = 'hidden';
            const zone: monaco.editor.IViewZone = {
                domNode,
                afterLineNumber,
                afterColumn,
                heightInLines,
                onDomNodeTop: zoneTop => this.updateTop(zoneTop),
                onComputedHeight: zoneHeight => this.updateHeight(zoneHeight)
            };
            this.viewZone = Object.assign(zone, {
                id: accessor.addZone(zone)
            });
            const id = this.viewZone.id;
            this.toHide.push(Disposable.create(() => {
                this.editor.changeViewZones(a => a.removeZone(id));
                this.viewZone = undefined;
            }));
            const widget: monaco.editor.IOverlayWidget = {
                getId: () => 'editor-zone-widget-' + id,
                getDomNode: () => this.zoneNode,
                // tslint:disable-next-line:no-null-keyword
                getPosition: () => null!
            };
            this.editor.addOverlayWidget(widget);
            this.toHide.push(Disposable.create(() => this.editor.removeOverlayWidget(widget)));
        });

        this.containerNode.style.top = 0 + 'px';
        this.containerNode.style.overflow = 'hidden';
        this.updateContainerHeight(heightInLines * lineHeight);

        const model = this.editor.getModel();
        if (model) {
            const revealLineNumber = Math.min(model.getLineCount(), Math.max(1, afterLineNumber + 1));
            this.editor.revealLine(revealLineNumber, monaco.editor.ScrollType.Smooth);
        }
    }

    layout(heightInLines: number): void {
        if (this.viewZone && this.viewZone.heightInLines !== heightInLines) {
            this.viewZone.heightInLines = heightInLines;
            const id = this.viewZone.id;
            this.editor.changeViewZones(accessor => accessor.layoutZone(id));
        }
    }

    protected updateTop(top: number): void {
        this.zoneNode.style.top = top + 'px';
    }
    protected updateHeight(zoneHeight: number): void {
        this.zoneNode.style.height = zoneHeight + 'px';
        this.updateContainerHeight(zoneHeight);
    }
    protected updateContainerHeight(zoneHeight: number): void {
        const height = zoneHeight;
        this.containerNode.style.height = height + 'px';
        const width = this.computeWidth();
        this.onDidLayoutChangeEmitter.fire({ height, width });
    }

    protected updateWidth(info: monaco.editor.EditorLayoutInfo = this.editor.getLayoutInfo()): void {
        const width = this.computeWidth(info);
        this.zoneNode.style.width = width + 'px';
        this.zoneNode.style.left = this.computeLeft(info) + 'px';
    }
    protected computeWidth(info: monaco.editor.EditorLayoutInfo = this.editor.getLayoutInfo()): number {
        return info.width - info.minimapWidth - info.verticalScrollbarWidth;
    }
    protected computeLeft(info: monaco.editor.EditorLayoutInfo = this.editor.getLayoutInfo()): number {
        // If minimap is to the left, we move beyond it
        if (info.minimapWidth > 0 && info.minimapLeft === 0) {
            return info.minimapWidth;
        }
        return 0;
    }

}
