import { createEditor } from '@toeverything/components/affine-editor';
import * as commands from '@toeverything/components/board-commands';
import { Tldraw } from '@toeverything/components/board-draw';
import { getSession } from '@toeverything/components/board-sessions';
import { deepCopy, TldrawApp } from '@toeverything/components/board-state';
import { tools } from '@toeverything/components/board-tools';
import { TDShapeType } from '@toeverything/components/board-types';
import {
    getClipDataOfBlocksById,
    RecastBlockProvider,
} from '@toeverything/components/editor-core';
import { services } from '@toeverything/datasource/db-service';
import { AsyncBlock, BlockEditor } from '@toeverything/framework/virgo';
import { useEffect, useState } from 'react';
import { useShapes } from './hooks';

interface AffineBoardProps {
    workspace: string;
    rootBlockId: string;
}

const AffineBoard = ({
    workspace,
    rootBlockId,
    editor,
}: AffineBoardProps & { editor: BlockEditor }) => {
    const [app, set_app] = useState<TldrawApp>();
    const [document] = useState(() => {
        return {
            ...deepCopy(TldrawApp.default_document),
            id: workspace,
            pages: {
                [rootBlockId]: {
                    id: rootBlockId,
                    name: `Page ${rootBlockId}`,
                    childIndex: 1,
                    shapes: {},
                    bindings: {},
                },
            },
            pageStates: {
                [rootBlockId]: {
                    id: rootBlockId,
                    camera: {
                        point: [0, 0],
                        zoom: 1,
                    },
                    selectedIds: [],
                },
            },
        };
    });

    const { shapes, bindings } = useShapes(workspace, rootBlockId);
    useEffect(() => {
        if (app) {
            app.replacePageContent(shapes || {}, bindings, {});
        }
    }, [app, shapes]);

    return (
        <Tldraw
            document={document}
            commands={commands}
            tools={tools}
            getSession={getSession}
            callbacks={{
                onMount(app) {
                    set_app(app);
                },

                async onCopy(e, groupIds) {
                    const clip = await getClipDataOfBlocksById(
                        editor,
                        groupIds
                    );

                    e.clipboardData?.setData(
                        clip.getMimeType(),
                        clip.getData()
                    );
                },
                async onChangePage(app, shapes, bindings, assets) {
                    Promise.all(
                        Object.entries(shapes).map(async ([id, shape]) => {
                            if (shape === undefined) {
                                return services.api.editorBlock.delete({
                                    workspace: workspace,
                                    id,
                                });
                            } else {
                                let block = (
                                    await services.api.editorBlock.get({
                                        workspace: workspace,
                                        ids: [shape.affineId],
                                    })
                                )?.[0];
                                if (!block) {
                                    block =
                                        await services.api.editorBlock.create({
                                            workspace: workspace,
                                            parentId:
                                                app.appState.currentPageId,
                                            type:
                                                shape.type ===
                                                TDShapeType.Editor
                                                    ? 'group'
                                                    : 'shape',
                                        });
                                }
                                shape.affineId = block.id;

                                Object.keys(bindings).forEach(bilingKey => {
                                    if (
                                        bindings[bilingKey]?.fromId === shape.id
                                    ) {
                                        bindings[bilingKey].fromId = block.id;
                                    }
                                    if (
                                        bindings[bilingKey]?.toId === shape.id
                                    ) {
                                        bindings[bilingKey].toId = block.id;
                                    }
                                });
                                return await services.api.editorBlock.update({
                                    workspace: shape.workspace,
                                    id: block.id,
                                    properties: {
                                        shapeProps: {
                                            value: JSON.stringify(shape),
                                        },
                                    },
                                });
                            }
                        })
                    );
                    let pageBindingsString = (
                        await services.api.editorBlock.get({
                            workspace: workspace,
                            ids: [rootBlockId],
                        })
                    )?.[0].properties.bindings?.value;
                    console.log(123123123);
                    let pageBindings = JSON.parse(pageBindingsString ?? '{}');
                    console.log(pageBindings, 3333, bindings);
                    Object.keys(bindings).forEach(bindingsKey => {
                        console.log(345345345345345);
                        if (!bindings[bindingsKey]) {
                            delete pageBindings[bindingsKey];
                        } else {
                            Object.assign(pageBindings, bindings);
                        }
                    });
                    services.api.editorBlock.update({
                        workspace: workspace,
                        id: rootBlockId,
                        properties: {
                            bindings: {
                                value: JSON.stringify(pageBindings),
                            },
                        },
                    });
                },
            }}
        />
    );
};

export const AffineBoardWitchContext = ({
    workspace,
    rootBlockId,
}: AffineBoardProps) => {
    const [editor, setEditor] = useState<BlockEditor>();
    useEffect(() => {
        const innerEditor = createEditor(workspace, rootBlockId, true);
        setEditor(innerEditor);
        return () => {
            innerEditor.dispose();
        };
    }, [workspace, rootBlockId]);

    const [page, setPage] = useState<AsyncBlock>();
    useEffect(() => {
        editor?.getBlockById(rootBlockId).then(block => {
            setPage(block);
        });
    }, [editor, rootBlockId]);
    return page ? (
        <RecastBlockProvider block={page}>
            <AffineBoard
                workspace={workspace}
                rootBlockId={rootBlockId}
                editor={editor}
            />
        </RecastBlockProvider>
    ) : null;
};
